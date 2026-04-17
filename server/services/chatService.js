const { sanitizeText } = require('./profanityFilter');

function chatKey(roomCode) {
  return `chat:${String(roomCode ?? '').toUpperCase()}`;
}

async function addChatMessage(redis, { roomCode, senderId, senderName, message }) {
  const code = String(roomCode ?? '').toUpperCase();
  const payload = {
    senderId: String(senderId ?? ''),
    senderName: sanitizeText(String(senderName ?? '')).slice(0, 24),
    message: sanitizeText(String(message ?? '')).slice(0, 240),
    timestamp: Date.now()
  };
  if (!payload.senderId || !payload.message) throw new Error('INVALID_MESSAGE');
  const key = chatKey(code);
  await redis.lpush(key, JSON.stringify(payload));
  await redis.ltrim(key, 0, 99);
  return payload;
}

async function getRecentChat(redis, { roomCode }) {
  const code = String(roomCode ?? '').toUpperCase();
  const key = chatKey(code);
  const rows = await redis.lrange(key, 0, 49);
  const out = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(String(r)));
    } catch {}
  }
  return out.reverse();
}

module.exports = { addChatMessage, getRecentChat };

