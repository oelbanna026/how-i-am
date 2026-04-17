const crypto = require('crypto');
const Card = require('../models/Card');
const Pack = require('../models/Pack');

const CATEGORY_LABEL_AR = {
  fruit: 'فاكهة',
  vegetable: 'خضار',
  food: 'أكل',
  animal: 'حيوان',
  object: 'جماد'
};

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABEL_AR));

async function ensureDefaultPacks() {
  const defs = [
    { key: 'fruit', name: 'Fruit Pack', categories: ['fruit'] },
    { key: 'food', name: 'Food Pack', categories: ['food'] },
    { key: 'animal', name: 'Animal Pack', categories: ['animal'] },
    { key: 'mixed', name: 'Mixed Pack', categories: ['fruit', 'vegetable', 'food', 'animal', 'object'] }
  ];
  for (const d of defs) {
    await Pack.findOneAndUpdate({ key: d.key }, { $setOnInsert: d }, { upsert: true, new: true }).lean();
  }
}

function normalizeSlug(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function guessDifficulty(category, slug) {
  const c = String(category ?? '').toLowerCase();
  const s = normalizeSlug(slug);
  if (c === 'fruit' || c === 'vegetable') return 'easy';
  if (c === 'animal') return s.length <= 6 ? 'easy' : 'medium';
  if (c === 'food') return 'medium';
  return 'medium';
}

function firstArabicLetterHint(nameAr) {
  const t = String(nameAr ?? '').trim();
  const ch = t ? t[0] : '';
  return ch ? `تبدأ بحرف ${ch}` : 'تبدأ بحرف؟';
}

function buildHint({ category, nameAr, clue }) {
  const cat = String(category ?? '').toLowerCase();
  const categoryHint = CATEGORY_LABEL_AR[cat] ?? 'تصنيف';
  const firstLetter = firstArabicLetterHint(nameAr);
  const hint = { category: categoryHint, firstLetter, clue: clue ? String(clue) : null };
  return hint;
}

function hashBuffer(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

async function validateCards() {
  const missing = await Card.find({
    $or: [
      { name: { $in: [null, ''] } },
      { category: { $in: [null, ''] } },
      { imagePath: { $in: [null, ''] } },
      { hint: { $in: [null] } },
      { difficulty: { $in: [null, ''] } },
      { slug: { $in: [null, ''] } }
    ]
  })
    .select({ _id: 1, name: 1, category: 1, imagePath: 1 })
    .lean();
  return { ok: missing.length === 0, missing };
}

async function deleteCharacterCards() {
  await Card.deleteMany({ category: 'character' });
}

async function getAllCards({ category, packKey } = {}) {
  await ensureDefaultPacks();
  const q = {};
  if (category) q.category = String(category).toLowerCase();
  if (packKey) {
    const pack = await Pack.findOne({ key: String(packKey).toLowerCase() }).lean();
    if (pack?.categories?.length) q.category = { $in: pack.categories };
  }
  return Card.find(q).sort({ category: 1, name: 1 }).lean();
}

async function getCardsByCategory(category) {
  const c = String(category ?? '').toLowerCase();
  if (!VALID_CATEGORIES.has(c)) return [];
  return Card.find({ category: c }).sort({ name: 1 }).lean();
}

async function getRandomCards(count, { category, packKey } = {}) {
  await ensureDefaultPacks();
  const n = Math.max(1, Math.min(200, Math.floor(Number(count) || 0)));
  const match = {};
  if (category) match.category = String(category).toLowerCase();
  if (packKey) {
    const pack = await Pack.findOne({ key: String(packKey).toLowerCase() }).lean();
    if (pack?.categories?.length) match.category = { $in: pack.categories };
  }
  const docs = await Card.aggregate([{ $match: match }, { $sample: { size: n } }]);
  return docs;
}

function assignCardsToPlayers(players, cards) {
  const list = Array.isArray(players) ? players : [];
  const chosen = Array.isArray(cards) ? cards : [];
  const byPlayerId = {};
  const usedCardIds = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const pid = String(list[i]?.id ?? list[i]?.playerId ?? '').trim();
    if (!pid) continue;
    const next = chosen.find((c) => c && c._id && !usedCardIds.has(String(c._id)));
    if (!next) break;
    usedCardIds.add(String(next._id));
    byPlayerId[pid] = next;
  }
  return byPlayerId;
}

function makeGuess({ card, guess }) {
  const g = String(guess ?? '').trim();
  const n = String(card?.name ?? '').trim();
  const ok = Boolean(g) && Boolean(n) && g.toLowerCase() === n.toLowerCase();
  return { correct: ok };
}

function getHint({ card, step = 0 }) {
  const hint = card?.hint ?? null;
  const s = Math.max(0, Math.floor(Number(step) || 0));
  const out = [];
  if (hint?.category) out.push(String(hint.category));
  if (s >= 1 && hint?.firstLetter) out.push(String(hint.firstLetter));
  if (s >= 2 && hint?.clue) out.push(String(hint.clue));
  return out;
}

module.exports = {
  CATEGORY_LABEL_AR,
  VALID_CATEGORIES,
  ensureDefaultPacks,
  normalizeSlug,
  guessDifficulty,
  buildHint,
  hashBuffer,
  validateCards,
  deleteCharacterCards,
  getAllCards,
  getCardsByCategory,
  getRandomCards,
  assignCardsToPlayers,
  makeGuess,
  getHint
};
