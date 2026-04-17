const { getCards } = require('./cardsCache');

function categories() {
  return ['All', 'fruit', 'vegetable', 'food', 'animal', 'object'];
}

function listByCategory(category) {
  const c = String(category ?? '').toLowerCase();
  const pool = Array.isArray(getCards()) ? getCards() : [];
  if (!c || c === 'all') return pool;
  return pool.filter((x) => String(x.category) === c);
}

function pickUniqueCharacters(category, count) {
  const pool = listByCategory(category);
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (pool.length < n) return [];
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, n).map((c) => ({
    id: String(c._id ?? ''),
    name: String(c.name ?? ''),
    category: String(c.category ?? ''),
    imagePath: String(c.imagePath ?? ''),
    hint: c.hint ?? null,
    difficulty: String(c.difficulty ?? 'medium')
  }));
}

module.exports = {
  categories,
  listByCategory,
  pickUniqueCharacters
};
