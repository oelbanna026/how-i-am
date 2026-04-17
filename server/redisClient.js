const Redis = require('ioredis');

function createMemoryRedis() {
  const kv = new Map();
  const lists = new Map();
  const sets = new Map();

  return {
    isMemory: true,
    async get(key) {
      return kv.has(key) ? String(kv.get(key)) : null;
    },
    async set(key, value) {
      kv.set(String(key), String(value));
      return 'OK';
    },
    async del(...keys) {
      let n = 0;
      for (const k of keys) {
        if (kv.delete(String(k))) n += 1;
        lists.delete(String(k));
        sets.delete(String(k));
      }
      return n;
    },
    async lpush(key, value) {
      const k = String(key);
      const list = lists.get(k) ?? [];
      list.unshift(String(value));
      lists.set(k, list);
      return list.length;
    },
    async ltrim(key, start, stop) {
      const k = String(key);
      const list = lists.get(k) ?? [];
      const s = Math.max(0, Number(start) || 0);
      const e = Number(stop);
      const end = Number.isFinite(e) ? e : list.length - 1;
      lists.set(k, list.slice(s, end + 1));
      return 'OK';
    },
    async lrange(key, start, stop) {
      const k = String(key);
      const list = lists.get(k) ?? [];
      const s = Math.max(0, Number(start) || 0);
      const e = Number(stop);
      const end = Number.isFinite(e) ? e : list.length - 1;
      return list.slice(s, end + 1);
    },
    async sadd(key, member) {
      const k = String(key);
      const set = sets.get(k) ?? new Set();
      const before = set.size;
      set.add(String(member));
      sets.set(k, set);
      return set.size > before ? 1 : 0;
    },
    async srem(key, member) {
      const k = String(key);
      const set = sets.get(k) ?? new Set();
      const ok = set.delete(String(member));
      sets.set(k, set);
      return ok ? 1 : 0;
    },
    async smembers(key) {
      const k = String(key);
      const set = sets.get(k) ?? new Set();
      return Array.from(set.values());
    }
  };
}

function createRedisClient() {
  const url = String(process.env.REDIS_URL ?? '').trim();
  if (!url) return createMemoryRedis();
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true
  });
  client.on('error', () => null);
  return client;
}

module.exports = { createRedisClient };

