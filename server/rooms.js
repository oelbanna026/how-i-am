const { nanoid } = require('nanoid');
const { getCards } = require('./cardsCache');

const MAX_PLAYERS = 2;
const TURN_MS = 60000;
const MIN_QUESTIONS_BEFORE_GUESS = 3;
const ROUNDS_TOTAL = 3;
const RECONNECT_GRACE_MS = 30000;
const MAX_GUESSES_PER_TURN = 1;

const SCORE_CORRECT_GUESS = 10;
const SCORE_CORRECT_DEDUCTION = 1;
const SCORE_WRONG_GUESS = 0;

function normalizeRoomCategory(raw) {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t || t === 'all') return null;
  if (t.includes('فواكه') || t.includes('fruit')) return 'fruit';
  if (t.includes('خضار') || t.includes('vegetable')) return 'vegetable';
  if (t.includes('حيوان') || t.includes('animal')) return 'animal';
  if (t.includes('جماد') || t.includes('object')) return 'object';
  if (t.includes('أكل') || t.includes('food')) return 'food';
  return null;
}

function pickUniqueCards(categoryRaw, count) {
  const pool = Array.isArray(getCards()) ? getCards() : [];
  const category = normalizeRoomCategory(categoryRaw);
  const filtered = category ? pool.filter((c) => String(c.category) === category) : pool.slice();
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (filtered.length < n) return [];
  for (let i = filtered.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = filtered[i];
    filtered[i] = filtered[j];
    filtered[j] = tmp;
  }
  return filtered.slice(0, n).map((c) => ({
    id: String(c._id ?? c.id ?? ''),
    name: String(c.name ?? ''),
    category: String(c.category ?? ''),
    imagePath: String(c.imagePath ?? ''),
    hint: c.hint ?? null,
    difficulty: String(c.difficulty ?? 'medium')
  }));
}

function nowMs() {
  return Date.now();
}

function computeGuessBonus(turnEndsAt) {
  const remainingMs = Math.max(0, Number(turnEndsAt ?? 0) - nowMs());
  const remainingSec = remainingMs / 1000;
  return Math.max(0, Math.min(10, Math.floor(remainingSec / 10)));
}

function assignRoundCards(room, order) {
  const cards = pickUniqueCards(room.category, order.length);
  if (!cards.length) throw new Error('NOT_ENOUGH_CARDS');
  const cardsByPlayerId = new Map();
  for (let i = 0; i < order.length; i += 1) {
    cardsByPlayerId.set(order[i], cards[i]);
  }
  return cardsByPlayerId;
}

function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function modeConfig(mode) {
  if (mode === 'Speed') return { turnMs: 15000 };
  if (mode === 'Battle') return { turnMs: 20000 };
  return { turnMs: TURN_MS };
}

function cleanName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 16);
}

function defaultPlayerName(playerId) {
  return `Player-${String(playerId).slice(0, 4)}`;
}

function normalizeAnswer(answer) {
  const a = String(answer ?? '').toUpperCase();
  if (a === 'YES' || a === 'NO') return a;
  return null;
}

function normalizeGuess(guess) {
  return String(guess ?? '').trim().toLowerCase();
}

function computeMajority(yesCount, noCount) {
  if (yesCount > noCount) return 'YES';
  if (noCount > yesCount) return 'NO';
  return null;
}

class RoomManager {
  constructor({ onEvent, saveGameRecord }) {
    this.rooms = new Map();
    this.onEvent = onEvent;
    this.saveGameRecord = saveGameRecord;
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupStalePlayers();
      } catch {}
    }, 5000);
  }

  emit(code, event, payload) {
    if (this.onEvent) this.onEvent(code, event, payload);
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  ensureUniqueRoomCode() {
    let tries = 0;
    while (tries < 30) {
      const code = createRoomCode();
      if (!this.rooms.has(code)) return code;
      tries += 1;
    }
    return nanoid(6).toUpperCase();
  }

  roomState(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const players = Array.from(room.players.values())
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        score: p.score,
        ready: Boolean(p.ready)
      }));

    const game = room.game;
    return {
      roomCode: room.code,
      roomName: room.roomName ?? null,
      maxPlayers: room.maxPlayers ?? MAX_PLAYERS,
      flow: room.flow,
      hostId: room.hostId,
      players,
      mode: room.mode,
      category: room.category,
      isPublic: typeof room.isPublic === 'boolean' ? room.isPublic : true,
      rounds: game?.roundsTotal ?? ROUNDS_TOTAL,
      currentRound: game?.currentRound ?? null,
      phase: game?.phase ?? null,
      currentTurn: game?.currentTurnPlayerId ?? null,
      timer: game
        ? { turnEndsAt: game.turnEndsAt, turnMs: game.turnMs }
        : null
    };
  }

  gameStateForViewer(codeOrRoom, viewerId, { revealSelf } = {}) {
    const room = typeof codeOrRoom === 'string' ? this.rooms.get(codeOrRoom) : codeOrRoom;
    if (!room || !room.game) return null;
    const game = room.game;

    const players = Array.from(room.players.values())
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => {
        const card = game.cardsByPlayerId.get(p.id) ?? null;
        const canSeeCard = p.id !== viewerId || Boolean(revealSelf);
        return {
          id: p.id,
          name: p.name,
          connected: p.connected,
          score: p.score,
          card: canSeeCard ? card : null
        };
      });

    const questions = game.questions.map((q) => {
      const values = Object.values(q.answers);
      return {
        id: q.id,
        askedBy: q.askedBy,
        text: q.text,
        createdAt: q.createdAt,
        answers: { ...q.answers },
        majority: q.majority ?? null,
        yesCount: values.filter((a) => a === 'YES').length,
        noCount: values.filter((a) => a === 'NO').length
      };
    });
    const myCard = Boolean(revealSelf) ? game.cardsByPlayerId.get(viewerId) ?? null : null;

    return {
      roomCode: room.code,
      flow: room.flow,
      phase: game.phase ?? 'playing',
      mode: room.mode,
      category: room.category,
      rounds: game.roundsTotal ?? ROUNDS_TOTAL,
      currentRound: game.currentRound ?? 1,
      currentTurn: game.currentTurnPlayerId,
      timer: { turnEndsAt: game.turnEndsAt, turnMs: game.turnMs },
      winnerId: game.winnerId,
      players,
      questions,
      scores: Object.fromEntries(players.map((p) => [p.id, p.score])),
      myCard
    };
  }

  createRoom({ host, mode, category, roomName, maxPlayers, turnMs, maxRounds, isPublic }) {
    const code = this.ensureUniqueRoomCode();
    const mp = 2;
    const cfg = modeConfig(mode || 'Classic');
    const tm = Number.isFinite(Number(turnMs))
      ? Math.max(10000, Math.min(120000, Math.floor(Number(turnMs))))
      : cfg.turnMs;
    const mr = ROUNDS_TOTAL;
    const room = {
      code,
      maxPlayers: mp,
      flow: 'waiting',
      hostId: host.id,
      roomName: String(roomName ?? '').trim().slice(0, 24) || null,
      mode: mode || 'Classic',
      category: category || 'All',
      isPublic: typeof isPublic === 'boolean' ? isPublic : true,
      settings: { turnMs: tm, maxRounds: mr },
      players: new Map(),
      game: null,
      timer: null
    };
    this.rooms.set(code, room);
    const join = this.joinRoom({ code, player: host });
    return { room, sessionToken: join.sessionToken, reconnected: join.reconnected };
  }

  joinRoom({ code, player }) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.flow !== 'waiting') throw new Error('ROOM_NOT_JOINABLE');
    if (room.players.size >= (room.maxPlayers ?? MAX_PLAYERS)) throw new Error('ROOM_FULL');
    if (!player?.id) throw new Error('MISSING_USER_ID');

    const existing = room.players.get(player.id);
    if (existing) {
      if (existing.connected) throw new Error('ALREADY_IN_ROOM');
      const withinGrace = typeof existing.disconnectedAt === 'number' && nowMs() - existing.disconnectedAt <= RECONNECT_GRACE_MS;
      if (!withinGrace) throw new Error('RECONNECT_WINDOW_EXPIRED');
      if (!player.sessionToken || player.sessionToken !== existing.sessionToken) throw new Error('INVALID_SESSION');
      existing.connected = true;
      existing.disconnectedAt = null;
      if (!room.hostId) room.hostId = existing.id;
      return { room, sessionToken: existing.sessionToken, reconnected: true };
    }

    const sessionToken = nanoid(18);
    room.players.set(player.id, {
      id: player.id,
      name: cleanName(player.name) ?? defaultPlayerName(player.id),
      connected: true,
      joinedAt: nowMs(),
      score: 0,
      ready: false,
      sessionToken,
      disconnectedAt: null
    });

    if (!room.hostId) room.hostId = player.id;
    return { room, sessionToken, reconnected: false };
  }

  leaveRoom({ code, playerId }) {
    const room = this.rooms.get(code);
    if (!room) return;

    room.players.delete(playerId);
    if (room.hostId === playerId) {
      room.hostId = Array.from(room.players.keys())[0] ?? null;
    }

    if (room.players.size === 0) {
      if (room.timer) clearInterval(room.timer);
      this.rooms.delete(code);
      return;
    }

    if (room.game && room.flow === 'playing') {
      const remaining = Array.from(room.players.keys());
      if (remaining.length === 1) {
        this.endGame(room, remaining[0], { reason: 'SURRENDER' });
      }
    }
  }

  markDisconnected(playerId) {
    for (const room of this.rooms.values()) {
      const p = room.players.get(playerId);
      if (p) {
        p.connected = false;
        p.disconnectedAt = nowMs();
      }
    }
  }

  cleanupStalePlayers() {
    const now = nowMs();
    for (const room of this.rooms.values()) {
      const stale = [];
      for (const p of room.players.values()) {
        if (p.connected) continue;
        if (typeof p.disconnectedAt !== 'number') continue;
        if (now - p.disconnectedAt > RECONNECT_GRACE_MS) stale.push(p.id);
      }
      if (!stale.length) continue;
      for (const pid of stale) {
        room.players.delete(pid);
        if (room.game?.order) {
          room.game.order = room.game.order.filter((x) => x !== pid);
        }
        if (room.hostId === pid) room.hostId = Array.from(room.players.keys())[0] ?? null;
      }

      if (room.players.size === 0) {
        if (room.timer) clearInterval(room.timer);
        this.rooms.delete(room.code);
        continue;
      }

      if (room.flow === 'playing' && room.game) {
        const remaining = Array.from(room.players.keys());
        if (remaining.length === 1) this.endGame(room, remaining[0], { reason: 'ALL_LEFT' });
      }
    }
  }

  setReady({ code, playerId, ready }) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.flow !== 'waiting') throw new Error('ROOM_NOT_WAITING');
    const p = room.players.get(playerId);
    if (!p) throw new Error('NOT_IN_ROOM');
    p.ready = Boolean(ready);
    return { ready: p.ready };
  }

  areAllReady(room) {
    if (room.players.size < 2) return false;
    for (const p of room.players.values()) {
      if (!p.ready) return false;
    }
    return true;
  }

  startGame({ code, requestedBy }) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.flow !== 'waiting') throw new Error('ROOM_NOT_STARTABLE');
    if (room.players.size < 2) throw new Error('NEED_AT_LEAST_2_PLAYERS');
    if (requestedBy !== room.hostId) throw new Error('NOT_HOST');
    if (!this.areAllReady(room)) throw new Error('NOT_ALL_READY');

    room.flow = 'starting';

    const order = Array.from(room.players.values())
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => p.id);

    const base = modeConfig(room.mode || 'Classic');
    const turnMs = room.settings?.turnMs ?? base.turnMs ?? TURN_MS;
    const cardsByPlayerId = assignRoundCards(room, order);

    room.game = {
      phase: 'playing',
      startedAt: nowMs(),
      endedAt: null,
      roundsTotal: ROUNDS_TOTAL,
      currentRound: 1,
      roundStartedAt: nowMs(),
      roundEndedAt: null,
      turnMs,
      currentTurnPlayerId: order[0],
      turnEndsAt: nowMs() + turnMs,
      order,
      winnerId: null,
      cardsByPlayerId,
      questions: [],
      openQuestionId: null,
      hintsUsedByPlayerId: new Set(),
      skipsByPlayerId: new Map(),
      guessesThisTurnByPlayerId: new Map(),
      turnsTaken: 0,
      maxTurns: ROUNDS_TOTAL * order.length * 4,
      roundResults: []
    };
    room.game.guessesThisTurnByPlayerId.set(room.game.currentTurnPlayerId, 0);

    this.emit(code, 'gameStart', {});
    room.flow = 'playing';
    this.startTimer(room);
    this.emit(code, 'turnUpdate', { currentTurn: room.game.currentTurnPlayerId, timer: { turnEndsAt: room.game.turnEndsAt, turnMs } });
  }

  startTimer(room) {
    if (room.timer) clearInterval(room.timer);
    room.timer = setInterval(() => {
      if (!room.game) return;
      if (room.flow !== 'playing') return;
      if (room.game.winnerId) return;
      if (room.game.phase !== 'playing') return;
      if (nowMs() < room.game.turnEndsAt) return;
      this.advanceTurn(room);
    }, 250);
  }

  advanceTurn(room) {
    const game = room.game;
    if (!game) return;
    if (game.phase !== 'playing') return;
    const ids = game.order.filter((id) => room.players.has(id));
    if (!ids.length) return;

    game.turnsTaken += 1;
    if (game.turnsTaken >= game.maxTurns) {
      this.endGame(room, null, { reason: 'MAX_TURNS' });
      return;
    }

    const currentIdx = ids.indexOf(game.currentTurnPlayerId);
    let nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % ids.length;

    let safety = 0;
    while (safety < ids.length) {
      const candidateId = ids[nextIdx];
      const skips = game.skipsByPlayerId.get(candidateId) ?? 0;
      if (skips > 0) {
        game.skipsByPlayerId.set(candidateId, skips - 1);
        nextIdx = (nextIdx + 1) % ids.length;
        safety += 1;
        continue;
      }
      break;
    }

    game.currentTurnPlayerId = ids[nextIdx];
    game.turnEndsAt = nowMs() + game.turnMs;
    game.openQuestionId = null;
    game.guessesThisTurnByPlayerId.set(game.currentTurnPlayerId, 0);
    this.emit(room.code, 'turnUpdate', { currentTurn: game.currentTurnPlayerId, timer: { turnEndsAt: game.turnEndsAt, turnMs: game.turnMs } });
  }

  sendQuestion({ code, playerId, text }) {
    const room = this.rooms.get(code);
    if (!room || !room.game) throw new Error('ROOM_NOT_FOUND');
    if (room.flow !== 'playing') throw new Error('GAME_NOT_PLAYING');
    if (room.game.phase !== 'playing') throw new Error('ROUND_NOT_PLAYING');
    if (playerId !== room.game.currentTurnPlayerId) throw new Error('NOT_YOUR_TURN');
    if (room.game.openQuestionId) throw new Error('QUESTION_ALREADY_OPEN');

    const qText = String(text ?? '').trim().slice(0, 120);
    if (!qText) throw new Error('EMPTY_QUESTION');

    const question = {
      id: nanoid(10),
      askedBy: playerId,
      text: qText,
      createdAt: nowMs(),
      answers: {},
      majority: null
    };
    for (const pid of room.players.keys()) {
      if (pid === playerId) continue;
      question.answers[pid] = null;
    }

    room.game.questions.unshift(question);
    room.game.questions = room.game.questions.slice(0, 20);
    room.game.openQuestionId = question.id;

    const values = Object.values(question.answers);
    this.emit(room.code, 'questionReceived', {
      roomCode: room.code,
      question: {
        id: question.id,
        askedBy: question.askedBy,
        text: question.text,
        createdAt: question.createdAt,
        answers: { ...question.answers },
        majority: null,
        yesCount: values.filter((a) => a === 'YES').length,
        noCount: values.filter((a) => a === 'NO').length
      }
    });

    return question;
  }

  sendAnswer({ code, playerId, questionId, answer }) {
    const room = this.rooms.get(code);
    if (!room || !room.game) throw new Error('ROOM_NOT_FOUND');
    if (room.flow !== 'playing') throw new Error('GAME_NOT_PLAYING');
    if (room.game.phase !== 'playing') throw new Error('ROUND_NOT_PLAYING');

    const game = room.game;
    if (!questionId || questionId !== game.openQuestionId) throw new Error('QUESTION_NOT_OPEN');
    const q = game.questions.find((x) => x.id === questionId);
    if (!q) throw new Error('QUESTION_NOT_FOUND');
    if (q.askedBy === playerId) throw new Error('ASKER_CANNOT_ANSWER');
    if (!(playerId in q.answers)) throw new Error('NOT_EXPECTED_TO_ANSWER');
    if (q.answers[playerId] !== null) throw new Error('ALREADY_ANSWERED');

    const normalized = normalizeAnswer(answer);
    if (!normalized) throw new Error('INVALID_ANSWER');
    q.answers[playerId] = normalized;

    const values = Object.values(q.answers);
    const yesCount = values.filter((a) => a === 'YES').length;
    const noCount = values.filter((a) => a === 'NO').length;
    const complete = values.every((a) => a === 'YES' || a === 'NO');
    const majority = complete ? computeMajority(yesCount, noCount) : null;

    if (complete) {
      q.majority = majority;
      room.game.openQuestionId = null;

      if (majority) {
        for (const [pid, a] of Object.entries(q.answers)) {
          if (a === majority) {
            const p = room.players.get(pid);
            if (p) p.score += SCORE_CORRECT_DEDUCTION;
          }
        }
      }
    }

    this.emit(room.code, 'answerResult', {
      roomCode: room.code,
      questionId: q.id,
      answeredBy: playerId,
      answer: normalized,
      yesCount,
      noCount,
      complete,
      majority,
      answers: { ...q.answers },
      scores: Object.fromEntries(Array.from(room.players.values()).map((x) => [x.id, x.score]))
    });

    if (complete) {
      this.advanceTurn(room);
    }

    return { yesCount, noCount, complete, majority };
  }

  useHint({ code, playerId }) {
    const room = this.rooms.get(code);
    if (!room || !room.game) throw new Error('ROOM_NOT_FOUND');
    if (room.flow !== 'playing') throw new Error('GAME_NOT_PLAYING');
    if (room.game.winnerId) throw new Error('GAME_ENDED');
    if (room.game.phase !== 'playing') throw new Error('ROUND_NOT_PLAYING');
    if (playerId !== room.game.currentTurnPlayerId) throw new Error('NOT_YOUR_TURN');
    if (room.game.hintsUsedByPlayerId?.has(playerId)) throw new Error('HINT_ALREADY_USED');

    const target = room.game.cardsByPlayerId.get(playerId);
    if (!target) throw new Error('NO_CARD');

    const type = Math.random() < 0.5 ? 'category' : 'first_letter';
    const value =
      type === 'category'
        ? String(target.category ?? '')
        : String(target.name ?? '').trim().slice(0, 1);
    room.game.hintsUsedByPlayerId.add(playerId);

    this.emit(room.code, 'hintUsed', { roomCode: room.code, playerId, type, value });
    return { type, value };
  }

  endRound(room, winnerId, { reason, card, scoreDelta } = {}) {
    const game = room.game;
    if (!game) return;
    if (game.phase !== 'playing') return;
    game.phase = 'round_result';
    game.roundEndedAt = nowMs();

    const p = winnerId ? room.players.get(winnerId) : null;
    const winnerName = p?.name ?? null;
    const payload = {
      roomCode: room.code,
      round: game.currentRound ?? 1,
      rounds: game.roundsTotal ?? ROUNDS_TOTAL,
      reason: reason ?? 'UNKNOWN',
      winnerId: winnerId ?? null,
      winnerName,
      correctAnswer: card ? { name: String(card.name ?? ''), imagePath: String(card.imagePath ?? '') } : null,
      pointsEarned: Number(scoreDelta ?? 0),
      scores: Object.fromEntries(Array.from(room.players.values()).map((x) => [x.id, x.score]))
    };
    game.roundResults = Array.isArray(game.roundResults) ? [...game.roundResults, payload] : [payload];
    this.emit(room.code, 'roundResult', payload);

    const nextRound = (game.currentRound ?? 1) + 1;
    if (nextRound > (game.roundsTotal ?? ROUNDS_TOTAL)) {
      const finalWinner =
        Array.from(room.players.values())
          .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.joinedAt - b.joinedAt))[0]?.id ?? null;
      this.endGame(room, finalWinner, { reason: 'FINAL_RESULT' });
      return;
    }

    setTimeout(() => {
      try {
        if (!room.game) return;
        if (room.flow !== 'playing') return;
        if (room.game.winnerId) return;

        room.game.currentRound = nextRound;
        room.game.phase = 'playing';
        room.game.roundStartedAt = nowMs();
        room.game.roundEndedAt = null;
        room.game.questions = [];
        room.game.openQuestionId = null;
        room.game.hintsUsedByPlayerId = new Set();
        room.game.skipsByPlayerId = new Map();
        room.game.guessesThisTurnByPlayerId = new Map();

        const order = Array.isArray(room.game.order) ? room.game.order : Array.from(room.players.keys());
        room.game.cardsByPlayerId = assignRoundCards(room, order);

        const startIdx = (nextRound - 1) % order.length;
        room.game.currentTurnPlayerId = order[startIdx] ?? order[0];
        room.game.turnEndsAt = nowMs() + room.game.turnMs;
        room.game.guessesThisTurnByPlayerId.set(room.game.currentTurnPlayerId, 0);
        this.emit(room.code, 'turnUpdate', { currentTurn: room.game.currentTurnPlayerId, timer: { turnEndsAt: room.game.turnEndsAt, turnMs: room.game.turnMs } });
      } catch {}
    }, 2500);
  }

  makeGuess({ code, playerId, guess }) {
    const room = this.rooms.get(code);
    if (!room || !room.game) throw new Error('ROOM_NOT_FOUND');
    if (room.flow !== 'playing') throw new Error('GAME_NOT_PLAYING');
    if (room.game.winnerId) throw new Error('GAME_ENDED');
    if (room.game.phase !== 'playing') throw new Error('ROUND_NOT_PLAYING');
    if (room.game.questions.length < MIN_QUESTIONS_BEFORE_GUESS) throw new Error('NEED_MORE_QUESTIONS');
    if (playerId !== room.game.currentTurnPlayerId) throw new Error('NOT_YOUR_TURN');

    const used = room.game.guessesThisTurnByPlayerId.get(playerId) ?? 0;
    if (used >= MAX_GUESSES_PER_TURN) throw new Error('GUESS_LIMIT_REACHED');

    const target = room.game.cardsByPlayerId.get(playerId);
    if (!target) throw new Error('NO_CARD');

    const correct = normalizeGuess(guess) === normalizeGuess(target.name);
    const p = room.players.get(playerId);
    if (!p) throw new Error('PLAYER_NOT_IN_ROOM');

    if (correct) {
      const bonus = computeGuessBonus(room.game.turnEndsAt);
      const delta = SCORE_CORRECT_GUESS + bonus;
      p.score += delta;
      room.game.guessesThisTurnByPlayerId.set(playerId, used + 1);
      const targetCard = target ?? null;
      this.emit(room.code, 'guessResult', {
        roomCode: room.code,
        playerId,
        guess: String(guess ?? '').trim().slice(0, 64),
        correct: true,
        target: targetCard ? { name: String(targetCard.name ?? ''), imagePath: String(targetCard.imagePath ?? '') } : null,
        penalty: null,
        scoreDelta: delta,
        scores: Object.fromEntries(Array.from(room.players.values()).map((x) => [x.id, x.score]))
      });
      this.endRound(room, playerId, { reason: 'CORRECT_GUESS', card: targetCard, scoreDelta: delta });
      return { correct: true };
    }

    p.score += SCORE_WRONG_GUESS;
    room.game.guessesThisTurnByPlayerId.set(playerId, used + 1);
    const skips = room.game.skipsByPlayerId.get(playerId) ?? 0;
    room.game.skipsByPlayerId.set(playerId, skips + 1);

    this.emit(room.code, 'guessResult', {
      roomCode: room.code,
      playerId,
      guess: String(guess ?? '').trim().slice(0, 64),
      correct: false,
      penalty: { skipTurns: 1 },
      scoreDelta: SCORE_WRONG_GUESS,
      scores: Object.fromEntries(Array.from(room.players.values()).map((x) => [x.id, x.score]))
    });
    return { correct: false };
  }

  async endGame(room, winnerId, { reason } = {}) {
    if (!room.game) return;
    const game = room.game;
    if (game.winnerId) return;

    const winner =
      winnerId ??
      Array.from(room.players.values())
        .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.joinedAt - b.joinedAt))[0]?.id ??
      null;

    game.winnerId = winner;
    game.endedAt = nowMs();
    game.phase = 'final_result';
    room.flow = 'ended';
    if (room.timer) clearInterval(room.timer);
    room.timer = null;

    const startedAt = new Date(game.startedAt);
    const endedAt = new Date(game.endedAt);
    const recordPayload = {
      roomCode: room.code,
      mode: room.mode,
      category: room.category,
      startedAt,
      endedAt,
      winnerId: winner ?? 'unknown',
      players: Array.from(room.players.values()).map((p) => {
        const card = game.cardsByPlayerId.get(p.id);
        return {
          playerId: p.id,
          name: p.name,
          score: p.score,
          cardName: card?.name ?? 'Unknown',
          cardCategory: card?.category ?? 'Unknown'
        };
      })
    };

    try {
      if (this.saveGameRecord) await this.saveGameRecord(recordPayload);
    } catch {}

    const scoreboard = Array.from(room.players.values())
      .map((p) => ({ playerId: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);

    this.emit(room.code, 'gameEnd', {
      roomCode: room.code,
      reason: reason || 'UNKNOWN',
      winnerId: winner,
      scoreboard
    });
  }
}

module.exports = {
  RoomManager,
  MAX_PLAYERS,
  modeConfig
};
