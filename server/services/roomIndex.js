function publicRoomsKey() {
  return 'rooms:public';
}

function roomMetaKey(code) {
  return `roommeta:${String(code ?? '').toUpperCase()}`;
}

async function indexRoom(redis, roomState) {
  const code = String(roomState?.roomCode ?? roomState?.code ?? '').trim().toUpperCase();
  if (!code) return;
  const isPublic = Boolean(roomState?.isPublic);
  const payload = {
    roomCode: code,
    roomName: roomState?.roomName ?? null,
    flow: roomState?.flow ?? null,
    mode: roomState?.mode ?? null,
    category: roomState?.category ?? null,
    maxPlayers: roomState?.maxPlayers ?? null,
    playersCount: Array.isArray(roomState?.players) ? roomState.players.length : null,
    updatedAt: Date.now()
  };
  await redis.set(roomMetaKey(code), JSON.stringify(payload));
  if (isPublic && payload.flow === 'waiting') await redis.sadd(publicRoomsKey(), code);
  else await redis.srem(publicRoomsKey(), code);
}

async function removeRoom(redis, code) {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return;
  await redis.srem(publicRoomsKey(), c);
  await redis.del(roomMetaKey(c));
}

async function listPublicRooms(redis) {
  const codes = await redis.smembers(publicRoomsKey());
  const out = [];
  for (const c of codes) {
    const raw = await redis.get(roomMetaKey(c));
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {}
  }
  out.sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
  return out.slice(0, 50);
}

module.exports = { indexRoom, removeRoom, listPublicRooms };

