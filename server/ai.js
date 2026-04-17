const { listByCategory } = require('./characters');

function rand() {
  return Math.random();
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeDifficulty(difficulty) {
  return difficulty === 'Hard' ? 'Hard' : 'Easy';
}

function createAIState({ category = 'All', difficulty = 'Hard' } = {}) {
  const pool = listByCategory(category);
  return {
    difficulty: normalizeDifficulty(difficulty),
    possibleCards: pool.map((c) => ({ id: c.id, name: c.name, category: c.category })),
    previousAnswers: []
  };
}

function processQuestion(_aiState, _questionText) {
  return { parsed: null };
}

function generateAnswer({ aiState, questionText }) {
  const answer = rand() < 0.5 ? 'YES' : 'NO';
  if (aiState) aiState.previousAnswers.push({ question: String(questionText ?? ''), answer });
  return { answer, parsed: null };
}

function applyObservedAnswer(aiState, questionText, answer) {
  const normalized = String(answer ?? '').toUpperCase();
  if (normalized !== 'YES' && normalized !== 'NO') return aiState;
  aiState.previousAnswers.push({ question: String(questionText ?? ''), answer: normalized });
  return aiState;
}

function makeGuess(aiState) {
  const candidates = aiState?.possibleCards ?? [];
  if (!candidates.length) return null;
  if ((aiState?.previousAnswers?.length ?? 0) < 3) return null;
  if (rand() < 0.85) return null;
  return pickOne(candidates).name;
}

module.exports = {
  createAIState,
  processQuestion,
  generateAnswer,
  applyObservedAnswer,
  makeGuess
};
