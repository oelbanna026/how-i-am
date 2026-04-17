const { nanoid } = require('nanoid');
const { assignCardsToPlayers, getRandomCards, getHint, makeGuess } = require('./cardsService');

const sessions = new Map();

function sanitizePlayers(players) {
  const list = Array.isArray(players) ? players : [];
  return list
    .map((p) => ({ id: String(p?.id ?? p?.playerId ?? '').trim(), name: String(p?.name ?? '').trim() || null }))
    .filter((p) => p.id);
}

async function startGame({ players, packKey, category }) {
  const list = sanitizePlayers(players);
  if (list.length < 1) throw new Error('NO_PLAYERS');
  const cards = await getRandomCards(list.length, { packKey, category });
  if (cards.length < list.length) throw new Error('NOT_ENOUGH_CARDS');
  const assignments = assignCardsToPlayers(list, cards);
  const gameId = nanoid(12);
  sessions.set(gameId, {
    id: gameId,
    createdAt: Date.now(),
    players: list,
    assignmentsByPlayerId: Object.fromEntries(Object.entries(assignments).map(([k, v]) => [k, String(v._id)])),
    hintStepByPlayerId: {}
  });
  return { gameId, players: list, assignments };
}

function getSession(gameId) {
  const id = String(gameId ?? '').trim();
  if (!id) return null;
  return sessions.get(id) ?? null;
}

function incHintStep(session, playerId) {
  const pid = String(playerId ?? '').trim();
  if (!pid) return 0;
  const curr = session.hintStepByPlayerId[pid] ?? 0;
  const next = Math.min(2, Math.max(0, curr + 1));
  session.hintStepByPlayerId[pid] = next;
  return next;
}

async function hint({ gameId, playerId, cardById }) {
  const session = getSession(gameId);
  if (!session) throw new Error('GAME_NOT_FOUND');
  const pid = String(playerId ?? '').trim();
  if (!pid) throw new Error('MISSING_PLAYER_ID');
  const cardId = session.assignmentsByPlayerId[pid];
  if (!cardId) throw new Error('NO_CARD_ASSIGNED');
  const step = incHintStep(session, pid);
  const card = await cardById(cardId);
  return { hints: getHint({ card, step }) };
}

async function guess({ gameId, playerId, guess, cardById }) {
  const session = getSession(gameId);
  if (!session) throw new Error('GAME_NOT_FOUND');
  const pid = String(playerId ?? '').trim();
  if (!pid) throw new Error('MISSING_PLAYER_ID');
  const cardId = session.assignmentsByPlayerId[pid];
  if (!cardId) throw new Error('NO_CARD_ASSIGNED');
  const card = await cardById(cardId);
  return makeGuess({ card, guess });
}

module.exports = {
  startGame,
  getSession,
  hint,
  guess
};

