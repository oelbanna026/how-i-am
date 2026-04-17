require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { createPersistence } = require('./mongo');
const { RoomManager } = require('./rooms');
const { VoiceManager, voiceRoomName } = require('./voice');
const PlayerProfile = require('./models/PlayerProfile');
const FriendRequest = require('./models/FriendRequest');
const path = require('path');
const Card = require('./models/Card');
const Pack = require('./models/Pack');
const { nanoid } = require('nanoid');
const GameRecord = require('./models/GameRecord');
const { VALID_CATEGORIES, ensureDefaultPacks } = require('./services/cardsService');
const gameService = require('./services/gameService');
const cardsCache = require('./cardsCache');
const { createRedisClient } = require('./redisClient');
const { addChatMessage, getRecentChat } = require('./services/chatService');
const { indexRoom, removeRoom, listPublicRooms } = require('./services/roomIndex');
const { sanitizeText } = require('./services/profanityFilter');
const { signAccessToken } = require('./services/authTokens');
const { verifyGoogleIdToken, verifyAppleIdToken } = require('./services/providerTokens');
const { authMiddleware } = require('./middleware/auth');

const PORT = Number(process.env.PORT || 3001);

async function main() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));

  app.get('/', (_req, res) =>
    res.json({
      ok: true,
      name: 'who-am-i-online-server',
      endpoints: ['/health', '/categories', '/cards', '/packs', '/game/start', '/game/guess', '/game/hint'],
      realtime: 'socket.io'
    })
  );
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/categories', (_req, res) => res.json({ categories: Array.from(VALID_CATEGORIES) }));

  app.use('/assets', express.static(path.join(__dirname, 'assets')));

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });

  const redis = createRedisClient();
  try {
    if (typeof redis.connect === 'function') await redis.connect();
  } catch {}

  const persistence = await createPersistence({ mongoUri: process.env.MONGODB_URI });

  try {
    const cards = await Card.find({ category: { $ne: 'character' } }).lean();
    cardsCache.setCards(cards);
  } catch {}
  const roomManager = new RoomManager({
    saveGameRecord: persistence.saveGameRecord,
    onEvent: (code, event, payload) => {
      if (event === 'questionReceived') io.to(code).emit('questionReceived', payload);
      if (event === 'answerResult') io.to(code).emit('answerResult', payload);
      if (event === 'guessResult') io.to(code).emit('guessResult', payload);
      if (event === 'gameStart') {
        emitRoomUpdate(code).catch(() => null);
        emitGameStart(code).catch(() => null);
      }
      if (event === 'turnUpdate') emitTurnUpdate(code).catch(() => null);
      if (event === 'gameEnd') {
        emitRoomUpdate(code).catch(() => null);
        io.to(code).emit('gameEnd', payload);
      }
    }
  });

  const voiceManager = new VoiceManager({
    livekitUrl: process.env.LIVEKIT_URL,
    livekitApiKey: process.env.LIVEKIT_API_KEY,
    livekitApiSecret: process.env.LIVEKIT_API_SECRET,
    getRoomById: (roomId) => roomManager.getRoom(String(roomId).toUpperCase())
  });

  const voiceConfigured = Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);

  app.post('/livekit/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    try {
      const authHeader = String(req.headers.authorization ?? '');
      const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');
      const { event, roomId } = await voiceManager.handleLiveKitWebhook({ body, authHeader });

      const kind = String(event?.event ?? '');
      const participantIdentity = String(event?.participant?.identity ?? '');
      const roomCode = String(roomId ?? '').toUpperCase();

      if (kind === 'participant_joined' && roomCode && participantIdentity) {
        voiceManager.ensureRoom(roomCode).participants.set(participantIdentity, {
          userId: participantIdentity,
          micOn: true,
          speaking: false,
          muted: false,
          mutedBy: new Set(),
          audioTrackSid: null,
          joinedAt: Date.now()
        });
        io.to(roomCode).emit('userJoinedVoice', { roomId: roomCode, userId: participantIdentity });
      }

      if (kind === 'participant_left' && roomCode && participantIdentity) {
        voiceManager.leaveVoiceRoom(roomCode, participantIdentity);
        io.to(roomCode).emit('userLeftVoice', { roomId: roomCode, userId: participantIdentity });
      }

      if ((kind === 'track_published' || kind === 'track_muted') && roomCode && participantIdentity) {
        const track = event?.track;
        const trackKind = String(track?.kind ?? track?.type ?? '').toLowerCase();
        const trackSid = String(track?.sid ?? '');
        const muted = Boolean(track?.muted);
        if (trackKind === 'audio') {
          const r = voiceManager.setMicFromWebhook(roomCode, participantIdentity, !muted, trackSid);
          if (r) io.to(roomCode).emit('userMuted', { roomId: roomCode, userId: participantIdentity, micOn: r.micOn });
        }
      }

      if ((kind === 'active_speakers_changed' || kind === 'room_active_speaker_changed') && roomCode) {
        const speakers = Array.isArray(event?.speakers) ? event.speakers : [];
        const activeIds = new Set(speakers.map((s) => String(s?.identity ?? '')).filter(Boolean));
        const state = voiceManager.ensureRoom(roomCode);
        for (const pid of state.participants.keys()) {
          const update = voiceManager.setSpeaking(roomCode, pid, activeIds.has(pid));
          if (update) io.to(roomCode).emit('userSpeaking', { roomId: roomCode, ...update });
        }
      }

      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.use(express.json({ limit: '1mb' }));

  app.post('/auth/guest', async (req, res) => {
    try {
      const deviceId = String(req.body?.deviceId ?? '').trim() || `d_${nanoid(10)}`;
      const username = sanitizeText(String(req.body?.username ?? 'Guest').trim()).slice(0, 24) || 'Guest';
      const avatarId = String(req.body?.avatar ?? req.body?.avatarId ?? 'a1').trim() || 'a1';
      const age = req.body?.age !== undefined ? Number(req.body.age) : null;
      const country = req.body?.country !== undefined ? String(req.body.country ?? '').trim().slice(0, 2).toUpperCase() : null;

      let doc = await PlayerProfile.findOne({ deviceId }).lean();
      if (!doc) {
        const playerId = `u_${nanoid(14)}`;
        doc = await PlayerProfile.findOneAndUpdate(
          { playerId },
          {
            $set: {
              playerId,
              deviceId,
              name: username,
              avatar: { id: avatarId },
              age: Number.isFinite(age) ? Math.max(5, Math.min(120, Math.floor(age))) : null,
              country: country || null
            }
          },
          { upsert: true, new: true }
        ).lean();
      }
      const token = await signAccessToken({ userId: doc.playerId });
      return res.json({
        ok: true,
        token,
        user: {
          id: doc.playerId,
          username: doc.name,
          avatar: doc.avatar ?? { id: 'a1' },
          age: doc.age ?? null,
          country: doc.country ?? null,
          coins: Number(doc.coins ?? 0),
          friends: Array.isArray(doc.friends) ? doc.friends : [],
          createdAt: doc.createdAt ?? null
        }
      });
    } catch (e) {
      return res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/auth/google', async (req, res) => {
    try {
      const idToken = String(req.body?.idToken ?? '').trim();
      const verified = await verifyGoogleIdToken(idToken);
      let doc = await PlayerProfile.findOne({ 'providers.google.providerUserId': verified.providerUserId }).lean();
      if (!doc) {
        const playerId = `u_${nanoid(14)}`;
        const username = sanitizeText(String(req.body?.username ?? 'Guest').trim()).slice(0, 24) || 'Guest';
        const avatarId = String(req.body?.avatar ?? req.body?.avatarId ?? 'a1').trim() || 'a1';
        doc = await PlayerProfile.findOneAndUpdate(
          { playerId },
          {
            $set: {
              playerId,
              deviceId: playerId,
              name: username,
              avatar: { id: avatarId },
              providers: { google: verified }
            }
          },
          { upsert: true, new: true }
        ).lean();
      }
      const token = await signAccessToken({ userId: doc.playerId });
      return res.json({ ok: true, token, userId: doc.playerId });
    } catch (e) {
      return res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/auth/apple', async (req, res) => {
    try {
      const idToken = String(req.body?.idToken ?? '').trim();
      const verified = await verifyAppleIdToken(idToken);
      let doc = await PlayerProfile.findOne({ 'providers.apple.providerUserId': verified.providerUserId }).lean();
      if (!doc) {
        const playerId = `u_${nanoid(14)}`;
        const username = sanitizeText(String(req.body?.username ?? 'Guest').trim()).slice(0, 24) || 'Guest';
        const avatarId = String(req.body?.avatar ?? req.body?.avatarId ?? 'a1').trim() || 'a1';
        doc = await PlayerProfile.findOneAndUpdate(
          { playerId },
          {
            $set: {
              playerId,
              deviceId: playerId,
              name: username,
              avatar: { id: avatarId },
              providers: { apple: verified }
            }
          },
          { upsert: true, new: true }
        ).lean();
      }
      const token = await signAccessToken({ userId: doc.playerId });
      return res.json({ ok: true, token, userId: doc.playerId });
    } catch (e) {
      return res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/profile', authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId ?? '').trim();
      if (!userId) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
      const doc = await PlayerProfile.findOne({ playerId: userId }).lean();
      if (!doc) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
      return res.json({
        ok: true,
        profile: { id: doc.playerId, name: doc.name, avatar: doc.avatar ?? { id: 'a1' }, age: doc.age ?? null, country: doc.country ?? null, coins: doc.coins ?? 0 }
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.put('/profile/update', authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId ?? '').trim();
      if (!userId) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
      const name = req.body?.username !== undefined ? sanitizeText(String(req.body.username ?? '').trim()).slice(0, 24) : undefined;
      const avatarId = req.body?.avatar !== undefined ? String(req.body.avatar ?? '').trim() : req.body?.avatarId !== undefined ? String(req.body.avatarId ?? '').trim() : undefined;
      const age = req.body?.age !== undefined ? Number(req.body.age) : undefined;
      const country = req.body?.country !== undefined ? String(req.body.country ?? '').trim().slice(0, 2).toUpperCase() : undefined;
      const update = {};
      if (name !== undefined && name) update.name = name;
      if (avatarId !== undefined && avatarId) update.avatar = { id: avatarId };
      if (age !== undefined) update.age = Number.isFinite(age) ? Math.max(5, Math.min(120, Math.floor(age))) : null;
      if (country !== undefined) update.country = country || null;
      const doc = await PlayerProfile.findOneAndUpdate({ playerId: userId }, { $set: update }, { new: true }).lean();
      return res.json({ ok: true, profile: { id: doc.playerId, name: doc.name, avatar: doc.avatar ?? { id: 'a1' }, age: doc.age ?? null, country: doc.country ?? null } });
    } catch (e) {
      return res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/cards', async (req, res) => {
    try {
      const category = req.query?.category ? String(req.query.category).toLowerCase() : null;
      const q = {};
      if (category) q.category = category;
      const cards = await Card.find(q).sort({ category: 1, name: 1 }).lean();
      res.json({ ok: true, cards });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/cards/category/:category', async (req, res) => {
    try {
      const category = String(req.params.category ?? '').toLowerCase();
      if (!VALID_CATEGORIES.has(category)) return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' });
      const cards = await Card.find({ category }).sort({ name: 1 }).lean();
      res.json({ ok: true, cards });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/packs', async (_req, res) => {
    try {
      await ensureDefaultPacks();
      const packs = await Pack.find({}).sort({ key: 1 }).lean();
      res.json({ ok: true, packs });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/game/start', async (req, res) => {
    try {
      const players = Array.isArray(req.body?.players) ? req.body.players : [];
      const packKey = req.body?.packKey ? String(req.body.packKey) : null;
      const category = req.body?.category ? String(req.body.category) : null;
      const r = await gameService.startGame({ players, packKey, category });
      res.json({
        ok: true,
        gameId: r.gameId,
        players: r.players,
        assignments: Object.fromEntries(Object.entries(r.assignments).map(([pid, c]) => [pid, { id: String(c._id), name: c.name, category: c.category, imagePath: c.imagePath }]))
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/game/guess', async (req, res) => {
    try {
      const gameId = String(req.body?.gameId ?? '').trim();
      const playerId = String(req.body?.playerId ?? '').trim();
      const guess = String(req.body?.guess ?? '').trim();
      const r = await gameService.guess({
        gameId,
        playerId,
        guess,
        cardById: async (id) => Card.findById(String(id)).lean()
      });
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/game/hint', async (req, res) => {
    try {
      const gameId = String(req.body?.gameId ?? '').trim();
      const playerId = String(req.body?.playerId ?? '').trim();
      const r = await gameService.hint({
        gameId,
        playerId,
        cardById: async (id) => Card.findById(String(id)).lean()
      });
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/rooms', async (_req, res) => {
    try {
      const rooms = await listPublicRooms(redis);
      return res.json({ ok: true, rooms });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/leaderboard', async (_req, res) => {
    try {
      const rows = await GameRecord.aggregate([
        { $group: { _id: '$winnerId', wins: { $sum: 1 } } },
        { $sort: { wins: -1 } },
        { $limit: 100 }
      ]);
      const ids = rows.map((r) => String(r._id ?? '')).filter(Boolean);
      const profiles = await PlayerProfile.find({ playerId: { $in: ids } }).lean();
      const byId = new Map(profiles.map((p) => [String(p.playerId), p]));
      const leaderboard = rows.map((r, i) => {
        const id = String(r._id ?? '');
        const p = byId.get(id);
        return {
          userId: id,
          wins: Number(r.wins ?? 0),
          losses: 0,
          rank: i + 1,
          name: p?.name ?? id.slice(0, 6),
          avatarId: String(p?.avatar?.id ?? 'a1'),
          country: p?.country ?? null
        };
      });
      return res.json({ ok: true, leaderboard });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/friends/request', authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId ?? '').trim();
      const friendId = String(req.body?.friendId ?? '').trim();
      if (!userId) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
      if (!friendId || friendId === userId) return res.status(400).json({ ok: false, error: 'INVALID_FRIEND' });
      await FriendRequest.findOneAndUpdate(
        { userId, friendId },
        { $set: { userId, friendId, status: 'pending' } },
        { upsert: true, new: true }
      ).lean();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/friends/respond', authMiddleware, async (req, res) => {
    try {
      const me = String(req.userId ?? '').trim();
      const userId = String(req.body?.userId ?? '').trim();
      const action = String(req.body?.action ?? '').trim().toLowerCase();
      if (!me) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
      if (!userId || userId === me) return res.status(400).json({ ok: false, error: 'INVALID_REQUEST' });
      if (action !== 'accept' && action !== 'reject') return res.status(400).json({ ok: false, error: 'INVALID_ACTION' });
      const status = action === 'accept' ? 'accepted' : 'rejected';
      const reqDoc = await FriendRequest.findOneAndUpdate(
        { userId, friendId: me },
        { $set: { status } },
        { new: true }
      ).lean();
      if (!reqDoc) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
      if (status === 'accepted') {
        await PlayerProfile.updateOne({ playerId: me }, { $addToSet: { friends: userId } }).catch(() => null);
        await PlayerProfile.updateOne({ playerId: userId }, { $addToSet: { friends: me } }).catch(() => null);
      }
      return res.json({ ok: true, status });
    } catch (e) {
      return res.status(400).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/profile/:playerId', async (req, res) => {
    try {
      const playerId = String(req.params.playerId ?? '').trim();
      if (!playerId) return res.status(400).json({ ok: false, error: 'MISSING_PLAYER_ID' });
      const doc = await PlayerProfile.findOne({ playerId }).lean();
      if (!doc) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
      return res.json({
        ok: true,
        profile: {
          playerId: doc.playerId,
          name: doc.name,
          avatarId: String(doc.avatar?.id ?? 'a1'),
          coins: Number(doc.coins ?? 0),
          ui: doc.ui ?? {},
          blockedUserIds: Array.isArray(doc.blockedUserIds) ? doc.blockedUserIds : []
        }
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/profile/:playerId', async (req, res) => {
    try {
      const playerId = String(req.params.playerId ?? '').trim();
      if (!playerId) return res.status(400).json({ ok: false, error: 'MISSING_PLAYER_ID' });
      const name = req.body?.name !== undefined ? String(req.body.name ?? '').trim().slice(0, 24) : undefined;
      const avatarId = req.body?.avatarId !== undefined ? String(req.body.avatarId ?? '').trim() : undefined;
      const ui = req.body?.ui !== undefined && typeof req.body.ui === 'object' && req.body.ui ? req.body.ui : undefined;
      const blockedUserIds =
        req.body?.blockedUserIds !== undefined && Array.isArray(req.body.blockedUserIds)
          ? req.body.blockedUserIds.map((x) => String(x)).filter(Boolean)
          : undefined;

      const update = {};
      if (name !== undefined && name) update.name = name;
      if (avatarId !== undefined && avatarId) update.avatar = { id: avatarId };
      if (ui !== undefined) update.ui = ui;
      if (blockedUserIds !== undefined) update.blockedUserIds = blockedUserIds;

      const doc = await PlayerProfile.findOneAndUpdate(
        { playerId },
        { $set: { ...update, playerId, deviceId: playerId } },
        { upsert: true, new: true }
      ).lean();

      return res.json({
        ok: true,
        profile: {
          playerId: doc.playerId,
          name: doc.name,
          avatarId: String(doc.avatar?.id ?? 'a1'),
          coins: Number(doc.coins ?? 0),
          ui: doc.ui ?? {},
          blockedUserIds: Array.isArray(doc.blockedUserIds) ? doc.blockedUserIds : []
        }
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post('/report', (req, res) => {
    const roomCode = String(req.body?.roomCode ?? '').trim().toUpperCase();
    const reporterId = String(req.body?.reporterId ?? '').trim();
    const reportedUserId = String(req.body?.reportedUserId ?? '').trim();
    const reason = String(req.body?.reason ?? '').trim().slice(0, 400);
    if (!roomCode || !reporterId || !reportedUserId || !reason) return res.status(400).json({ ok: false, error: 'INVALID_REPORT' });
    return res.json({ ok: true });
  });

  async function emitRoomUpdate(code) {
    const state = roomManager.roomState(code);
    if (!state) return;
    io.to(code).emit('roomUpdate', state);
    try {
      await indexRoom(redis, state);
    } catch {}
  }

  async function emitGameStart(code) {
    const room = roomManager.getRoom(code);
    if (!room) return;
    const sockets = await io.in(code).fetchSockets();
    for (const s of sockets) {
      const userId = s.data.userId ?? s.id;
      s.emit('gameStart', roomManager.gameStateForViewer(room, userId, { revealSelf: true }));
    }
  }

  async function emitTurnUpdate(code) {
    const room = roomManager.getRoom(code);
    if (!room) return;
    const sockets = await io.in(code).fetchSockets();
    for (const s of sockets) {
      const userId = s.data.userId ?? s.id;
      s.emit('turnUpdate', roomManager.gameStateForViewer(room, userId, { revealSelf: false }));
    }
  }

  io.on('connection', (socket) => {
    socket.data.roomCode = null;
    socket.data.voiceRoomCode = null;
    socket.data.userId = null;
    socket.data.sessionToken = null;

    const requireInRoom = () => {
      const code = String(socket.data.roomCode ?? '').trim().toUpperCase();
      const userId = String(socket.data.userId ?? '').trim();
      if (!code) throw new Error('NOT_IN_ROOM');
      if (!userId) throw new Error('NOT_AUTHED');
      const room = roomManager.getRoom(code);
      if (!room) throw new Error('ROOM_NOT_FOUND');
      const p = room.players.get(userId);
      if (!p) throw new Error('NOT_IN_ROOM');
      if (!socket.data.sessionToken || socket.data.sessionToken !== p.sessionToken) throw new Error('INVALID_SESSION');
      return { code, userId, room };
    };

    socket.on('createRoom', async (payload, ack) => {
      try {
        const userId = String(payload?.userId ?? '').trim();
        if (!userId) throw new Error('MISSING_USER_ID');
        const created = roomManager.createRoom({
          host: { id: userId, name: payload?.name ?? null },
          roomName: payload?.roomName ?? null,
          mode: payload?.mode ?? 'Classic',
          category: payload?.category ?? 'All',
          maxPlayers: payload?.maxPlayers,
          maxRounds: payload?.maxRounds,
          turnMs: payload?.turnMs,
          isPublic: payload?.isPublic
        });
        const room = created.room;

        socket.data.roomCode = room.code;
        socket.data.userId = userId;
        socket.data.sessionToken = created.sessionToken;
        socket.join(room.code);

        await emitRoomUpdate(room.code);
        try {
          const chat = await getRecentChat(redis, { roomCode: room.code });
          socket.emit('chatHistory', { roomCode: room.code, messages: chat });
        } catch {}
        let voice = null;
        if (voiceConfigured) {
          try {
            voice = voiceManager.joinVoiceRoom(room.code, userId);
            socket.data.voiceRoomCode = room.code;
            io.to(room.code).emit('userJoinedVoice', { roomId: room.code, userId });
          } catch {}
        }
        if (typeof ack === 'function') ack({ ok: true, roomCode: room.code, sessionToken: created.sessionToken, voice });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('joinRoom', async (payload, ack) => {
      try {
        const code = String(payload?.code ?? '').trim().toUpperCase();
        if (!code) throw new Error('MISSING_CODE');
        const userId = String(payload?.userId ?? '').trim();
        if (!userId) throw new Error('MISSING_USER_ID');
        const join = roomManager.joinRoom({
          code,
          player: { id: userId, name: payload?.name ?? null, sessionToken: payload?.sessionToken ?? null }
        });

        socket.data.roomCode = code;
        socket.data.userId = userId;
        socket.data.sessionToken = join.sessionToken;
        socket.join(code);

        await emitRoomUpdate(code);
        const room = roomManager.getRoom(code);
        if (room?.flow === 'playing') {
          socket.emit('turnUpdate', roomManager.gameStateForViewer(room, userId, { revealSelf: false }));
        }
        try {
          const chat = await getRecentChat(redis, { roomCode: code });
          socket.emit('chatHistory', { roomCode: code, messages: chat });
        } catch {}
        let voice = null;
        if (voiceConfigured) {
          try {
            voice = voiceManager.joinVoiceRoom(code, userId);
            socket.data.voiceRoomCode = code;
            io.to(code).emit('userJoinedVoice', { roomId: code, userId });
          } catch {}
        }
        if (typeof ack === 'function') ack({ ok: true, roomCode: code, sessionToken: join.sessionToken, voice });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('leaveRoom', async (ack) => {
      try {
        const code = socket.data.roomCode;
        if (code) {
          const userId = String(socket.data.userId ?? '').trim();
          if (userId) roomManager.leaveRoom({ code, playerId: userId });
          socket.leave(code);
          socket.data.roomCode = null;
          await emitRoomUpdate(code);
          const room = roomManager.getRoom(code);
          if (!room) {
            try {
              await removeRoom(redis, code);
            } catch {}
          }
        }
        if (socket.data.voiceRoomCode) {
          const vCode = socket.data.voiceRoomCode;
          const userId = String(socket.data.userId ?? '').trim();
          if (userId) voiceManager.leaveVoiceRoom(vCode, userId);
          socket.data.voiceRoomCode = null;
          if (userId) io.to(vCode).emit('userLeftVoice', { roomId: vCode, userId });
        }
        socket.data.userId = null;
        socket.data.sessionToken = null;
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('joinVoiceRoom', async (payload, ack) => {
      try {
        if (!voiceConfigured) throw new Error('LIVEKIT_NOT_CONFIGURED');
        const { code, userId } = requireInRoom();
        const roomId = String(payload?.roomId ?? code ?? '').trim().toUpperCase();
        if (!roomId) throw new Error('MISSING_ROOM');
        if (roomId !== socket.data.roomCode) throw new Error('NOT_IN_ROOM');
        const voice = voiceManager.joinVoiceRoom(roomId, userId);
        socket.data.voiceRoomCode = roomId;
        io.to(roomId).emit('userJoinedVoice', { roomId, userId });
        if (typeof ack === 'function') ack({ ok: true, voice });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('leaveVoiceRoom', async (ack) => {
      try {
        const roomId = String(socket.data.voiceRoomCode ?? '').trim().toUpperCase();
        if (roomId) {
          const userId = String(socket.data.userId ?? '').trim();
          if (userId) voiceManager.leaveVoiceRoom(roomId, userId);
          socket.data.voiceRoomCode = null;
          if (userId) io.to(roomId).emit('userLeftVoice', { roomId, userId });
        }
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('toggleMic', async (ack) => {
      try {
        const { code, userId } = requireInRoom();
        const roomId = String(socket.data.voiceRoomCode ?? code ?? '').trim().toUpperCase();
        if (!roomId) throw new Error('NOT_IN_ROOM');
        const result = await voiceManager.toggleMic(roomId, userId);
        io.to(roomId).emit('userMuted', { roomId, userId, micOn: result.micOn });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('muteUser', async (payload, ack) => {
      try {
        const { code, userId } = requireInRoom();
        const roomId = String(socket.data.voiceRoomCode ?? code ?? '').trim().toUpperCase();
        if (!roomId) throw new Error('NOT_IN_ROOM');
        const targetUserId = String(payload?.userId ?? '').trim();
        if (!targetUserId) throw new Error('MISSING_USER');
        const result = await voiceManager.muteUser(roomId, userId, targetUserId, payload?.muted);
        io.to(roomId).emit('userMuted', { roomId, ...result });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('startGame', async (ack) => {
      try {
        const { code, userId } = requireInRoom();
        roomManager.startGame({ code, requestedBy: userId });
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('setReady', async (payload, ack) => {
      try {
        const { code, userId } = requireInRoom();
        const result = roomManager.setReady({ code, playerId: userId, ready: payload?.ready });
        await emitRoomUpdate(code);
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('sendQuestion', async (payload, ack) => {
      try {
        const { code, userId } = requireInRoom();
        const q = roomManager.sendQuestion({ code, playerId: userId, text: payload?.text });
        if (typeof ack === 'function') ack({ ok: true, questionId: q.id });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('sendAnswer', async (payload, ack) => {
      try {
        const { code, userId } = requireInRoom();
        const result = roomManager.sendAnswer({
          code,
          playerId: userId,
          questionId: payload?.questionId,
          answer: payload?.answer
        });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('sendReaction', async (payload, ack) => {
      try {
        const { code, userId } = requireInRoom();
        const emoji = String(payload?.emoji ?? '').trim().slice(0, 4);
        if (!emoji) throw new Error('MISSING_EMOJI');
        io.to(code).emit('reaction', { roomCode: code, userId, emoji, ts: Date.now() });
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('sendMessage', async (payload, ack) => {
      try {
        const { code, userId, room } = requireInRoom();
        const p = room.players.get(userId);
        const senderName = String(p?.name ?? payload?.senderName ?? '').trim();
        const message = String(payload?.message ?? '').trim();
        const msg = await addChatMessage(redis, { roomCode: code, senderId: userId, senderName, message });
        io.to(code).emit('chatMessage', { roomCode: code, ...msg });
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('useHint', async (_payload, ack) => {
      try {
        const { code, userId } = requireInRoom();
        const result = roomManager.useHint({ code, playerId: userId });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('makeGuess', async (payload, ack) => {
      try {
        const { code, userId } = requireInRoom();
        const result = roomManager.makeGuess({ code, playerId: userId, guess: payload?.guess });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: String(e?.message ?? e) });
      }
    });

    socket.on('disconnect', async () => {
      const code = socket.data.roomCode;
      const userId = String(socket.data.userId ?? '').trim();
      if (userId) roomManager.markDisconnected(userId);
      if (code) await emitRoomUpdate(code);
      if (socket.data.voiceRoomCode) {
        const vCode = socket.data.voiceRoomCode;
        if (userId) voiceManager.leaveVoiceRoom(vCode, userId);
        socket.data.voiceRoomCode = null;
        if (userId) io.to(vCode).emit('userLeftVoice', { roomId: vCode, userId });
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error('Server failed to start:', e?.message ?? e);
  process.exit(1);
});
