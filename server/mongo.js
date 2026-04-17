const mongoose = require('mongoose');
const PlayerProfile = require('./models/PlayerProfile');
const GameRecord = require('./models/GameRecord');
const dns = require('dns');

function createMemoryPersistence() {
  const profilesByDeviceId = new Map();
  const profilesByPlayerId = new Map();
  const gameRecords = [];

  return {
    async loadOrCreateProfile({ deviceId, name, avatar }) {
      const key = String(deviceId ?? '').trim();
      if (!key) throw new Error('MISSING_DEVICE_ID');
      const existing = profilesByDeviceId.get(key);
      if (existing) return { ...existing };

      const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
      const created = {
        playerId,
        deviceId: key,
        name: String(name ?? 'Guest'),
        avatar: avatar ?? { id: 'a1' },
        coins: 100,
        ui: {},
        blockedUserIds: []
      };
      profilesByDeviceId.set(key, created);
      profilesByPlayerId.set(playerId, created);
      return { ...created };
    },
    async persistProfile({ playerId, patch }) {
      const id = String(playerId ?? '').trim();
      if (!id) throw new Error('MISSING_PLAYER_ID');
      const existing = profilesByPlayerId.get(id);
      if (!existing) return null;
      const next = { ...existing, ...(patch ?? {}) };
      profilesByPlayerId.set(id, next);
      profilesByDeviceId.set(String(next.deviceId ?? ''), next);
      return { ...next };
    },
    async saveGameRecord(payload) {
      const rec = { ...(payload ?? {}), _id: `g_${Math.random().toString(36).slice(2, 10)}` };
      gameRecords.push(rec);
      return { ...rec };
    }
  };
}

async function createPersistence({ mongoUri }) {
  if (!mongoUri) return createMemoryPersistence();

  if (String(mongoUri).startsWith('mongodb+srv://')) {
    const serversRaw = String(process.env.MONGODB_DNS_SERVERS ?? '1.1.1.1,8.8.8.8');
    const servers = serversRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (servers.length) dns.setServers(servers);
  }

  try {
    await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || undefined });
  } catch (e) {
    console.warn('MongoDB connection failed, falling back to in-memory persistence:', String(e?.message ?? e));
    return createMemoryPersistence();
  }

  return {
    async loadOrCreateProfile({ deviceId, name, avatar }) {
      const existing = await PlayerProfile.findOne({ deviceId }).lean();
      if (existing) return existing;

      const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
      const created = await PlayerProfile.create({ playerId, deviceId, name, avatar, coins: 100 });
      return created.toObject();
    },
    async persistProfile({ playerId, patch }) {
      const updated = await PlayerProfile.findOneAndUpdate(
        { playerId },
        { $set: patch },
        { new: true }
      ).lean();
      return updated;
    },
    async saveGameRecord(payload) {
      const created = await GameRecord.create(payload);
      return created.toObject();
    }
  };
}

module.exports = {
  createPersistence
};
