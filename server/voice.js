const { AccessToken, RoomServiceClient, WebhookReceiver } = require('livekit-server-sdk');

function nowMs() {
  return Date.now();
}

function voiceRoomName(roomId) {
  return `voice_${String(roomId).toUpperCase()}`;
}

function toBool(v) {
  return Boolean(v);
}

class VoiceManager {
  constructor({ livekitUrl, livekitApiKey, livekitApiSecret, getRoomById }) {
    this.livekitUrl = livekitUrl;
    this.livekitApiKey = livekitApiKey;
    this.livekitApiSecret = livekitApiSecret;
    this.getRoomById = getRoomById;

    this.rooms = new Map();
    this.roomService =
      livekitUrl && livekitApiKey && livekitApiSecret
        ? new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret)
        : null;
    this.webhookReceiver =
      livekitApiKey && livekitApiSecret ? new WebhookReceiver(livekitApiKey, livekitApiSecret) : null;
  }

  ensureRoom(roomId) {
    const key = String(roomId).toUpperCase();
    let state = this.rooms.get(key);
    if (!state) {
      state = {
        roomId: key,
        participants: new Map()
      };
      this.rooms.set(key, state);
    }
    return state;
  }

  requirePlayerInRoom(roomId, userId) {
    const room = this.getRoomById ? this.getRoomById(roomId) : null;
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (!room.players || !room.players.has(userId)) throw new Error('NOT_IN_ROOM');
    return room;
  }

  isHost(roomId, userId) {
    const room = this.getRoomById ? this.getRoomById(roomId) : null;
    if (!room) return false;
    return room.hostId === userId;
  }

  publicState(roomId) {
    const state = this.ensureRoom(roomId);
    return {
      roomId: state.roomId,
      participants: Array.from(state.participants.values()).map((p) => ({
        userId: p.userId,
        micOn: p.micOn,
        speaking: p.speaking,
        muted: p.muted
      }))
    };
  }

  createToken(roomId, userId) {
    if (!this.livekitApiKey || !this.livekitApiSecret) throw new Error('LIVEKIT_NOT_CONFIGURED');
    const at = new AccessToken(this.livekitApiKey, this.livekitApiSecret, {
      identity: String(userId)
    });
    at.addGrant({
      roomJoin: true,
      room: voiceRoomName(roomId),
      canPublish: true,
      canSubscribe: true
    });
    return at.toJwt();
  }

  joinVoiceRoom(roomId, userId) {
    const gameRoom = this.requirePlayerInRoom(roomId, userId);
    if (gameRoom.players.size > 6) throw new Error('ROOM_FULL');

    const state = this.ensureRoom(roomId);
    let p = state.participants.get(userId);
    if (!p) {
      p = {
        userId,
        micOn: true,
        speaking: false,
        muted: false,
        mutedBy: new Set(),
        audioTrackSid: null,
        joinedAt: nowMs()
      };
      state.participants.set(userId, p);
    }

    return {
      livekitUrl: this.livekitUrl,
      voiceRoomId: voiceRoomName(roomId),
      token: this.createToken(roomId, userId),
      state: this.publicState(roomId)
    };
  }

  leaveVoiceRoom(roomId, userId) {
    const state = this.ensureRoom(roomId);
    state.participants.delete(userId);
    return this.publicState(roomId);
  }

  async toggleMic(roomId, userId) {
    this.requirePlayerInRoom(roomId, userId);
    const state = this.ensureRoom(roomId);
    const p = state.participants.get(userId);
    if (!p) throw new Error('NOT_IN_VOICE');
    p.micOn = !p.micOn;
    if (p.audioTrackSid && this.roomService) {
      try {
        await this.roomService.mutePublishedTrack(voiceRoomName(roomId), String(userId), p.audioTrackSid, !p.micOn);
      } catch {}
    }
    return { userId, micOn: p.micOn };
  }

  async muteUser(roomId, requestedBy, targetUserId, muted) {
    this.requirePlayerInRoom(roomId, requestedBy);
    if (!this.isHost(roomId, requestedBy) && requestedBy !== targetUserId) throw new Error('NOT_ALLOWED');

    const state = this.ensureRoom(roomId);
    const p = state.participants.get(targetUserId);
    if (!p) throw new Error('NOT_IN_VOICE');

    const shouldMute = muted === undefined ? !p.muted : toBool(muted);
    if (shouldMute) p.mutedBy.add(requestedBy);
    else p.mutedBy.delete(requestedBy);
    p.muted = p.mutedBy.size > 0;

    if (p.audioTrackSid && this.roomService) {
      try {
        await this.roomService.mutePublishedTrack(voiceRoomName(roomId), String(targetUserId), p.audioTrackSid, p.muted);
      } catch {}
    }

    return { userId: targetUserId, muted: p.muted, mutedBy: Array.from(p.mutedBy) };
  }

  setSpeaking(roomId, userId, speaking) {
    const state = this.ensureRoom(roomId);
    const p = state.participants.get(userId);
    if (!p) return null;
    const next = toBool(speaking);
    if (p.speaking === next) return null;
    p.speaking = next;
    return { userId, speaking: p.speaking };
  }

  setMicFromWebhook(roomId, userId, micOn, audioTrackSid) {
    const state = this.ensureRoom(roomId);
    let p = state.participants.get(userId);
    if (!p) {
      p = {
        userId,
        micOn: true,
        speaking: false,
        muted: false,
        mutedBy: new Set(),
        audioTrackSid: null,
        joinedAt: nowMs()
      };
      state.participants.set(userId, p);
    }
    if (audioTrackSid) p.audioTrackSid = audioTrackSid;
    p.micOn = toBool(micOn);
    return { userId, micOn: p.micOn };
  }

  async handleLiveKitWebhook({ body, authHeader }) {
    if (!this.webhookReceiver) throw new Error('LIVEKIT_NOT_CONFIGURED');
    const event = await this.webhookReceiver.receive(body, authHeader);
    const roomName = String(event?.room?.name ?? '');
    const roomId = roomName.replace(/^voice_/, '').toUpperCase();

    return { event, roomId };
  }
}

module.exports = { VoiceManager, voiceRoomName };

