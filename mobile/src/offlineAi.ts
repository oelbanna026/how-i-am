import type { Answer, Category, Character, GameMode, Player, QuestionPublic } from './types';
import { characterPool, imageUriForName, pickUnique, type CharacterDef } from './characters';

type OfflineParticipant = Player & {
  target: CharacterDef;
  isAi: boolean;
};

export type OfflineState = {
  mode: GameMode;
  category: Category | string;
  players: OfflineParticipant[];
  currentTurnPlayerId: string;
  turnEndsAt: number;
  turnMs: number;
  winnerId: string | null;
  questions: QuestionPublic[];
  awaitingHumanAnswer: { questionId: string; askedById: string } | null;
};

function nowMs() {
  return Date.now();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function modeTurnMs(mode: GameMode) {
  if (mode === 'Speed') return 15000;
  if (mode === 'Battle') return 20000;
  return 25000;
}

function normalizeGuess(s: string) {
  return s.trim().toLowerCase();
}

function questionToPredicate(text: string) {
  const t = text.toLowerCase();
  if (t.includes('human')) return (c: CharacterDef) => c.attrs.human;
  if (t.includes('famous')) return (c: CharacterDef) => c.attrs.famous;
  if (t.includes('male')) return (c: CharacterDef) => c.attrs.gender === 'male';
  if (t.includes('female')) return (c: CharacterDef) => c.attrs.gender === 'female';
  if (t.includes('alive')) return (c: CharacterDef) => c.attrs.alive;
  return null;
}

function aiPickQuestion(candidates: CharacterDef[]) {
  const questions = [
    'Am I a human?',
    'Am I famous?',
    'Am I male?',
    'Am I female?',
    'Am I alive?'
  ];

  let best = questions[0];
  let bestScore = Infinity;
  for (const q of questions) {
    const pred = questionToPredicate(q);
    if (!pred) continue;
    const yes = candidates.filter(pred).length;
    const no = candidates.length - yes;
    const score = Math.abs(yes - no);
    if (score < bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return best;
}

function applyAnswerFilter(candidates: CharacterDef[], questionText: string, answer: Answer) {
  const pred = questionToPredicate(questionText);
  if (!pred) return candidates;
  if (answer === 'YES') return candidates.filter(pred);
  return candidates.filter((c) => !pred(c));
}

function aiCandidatesForSelf(state: OfflineState, aiId: string) {
  const meId = state.players[0]?.id;
  if (!meId) return characterPool;
  let candidates = characterPool;
  for (const q of state.questions) {
    if (q.askedBy !== aiId) continue;
    const a = q.answers[meId] as Answer | null | undefined;
    if (a === 'YES' || a === 'NO') candidates = applyAnswerFilter(candidates, q.text, a);
  }
  return candidates;
}

export function createOfflineGame(args: {
  me: { id: string; name: string; avatar: any };
  mode: GameMode;
  category: Category | string;
}): OfflineState {
  const mode = args.mode;
  const category = args.category;
  const picked = pickUnique(category, 3);
  const meTarget = picked[0] ?? characterPool[0];
  const ai1Target = picked[1] ?? characterPool[1];
  const ai2Target = picked[2] ?? characterPool[2];

  const players: OfflineParticipant[] = [
    {
      id: args.me.id,
      name: args.me.name,
      avatar: args.me.avatar,
      coins: 100,
      isAi: false,
      target: meTarget,
      character: null
    },
    {
      id: 'ai_1',
      name: 'AI Sphinx',
      avatar: { id: 'ai1', emoji: '🧩', color: '#06B6D4' },
      coins: 999,
      isAi: true,
      target: ai1Target,
      character: { name: ai1Target.name, category: ai1Target.category, imageUri: imageUriForName(ai1Target.name) }
    },
    {
      id: 'ai_2',
      name: 'AI Pharaoh',
      avatar: { id: 'ai2', emoji: '🦂', color: '#F59E0B' },
      coins: 999,
      isAi: true,
      target: ai2Target,
      character: { name: ai2Target.name, category: ai2Target.category, imageUri: imageUriForName(ai2Target.name) }
    }
  ];

  return {
    mode,
    category,
    players,
    currentTurnPlayerId: players[0].id,
    turnMs: modeTurnMs(mode),
    turnEndsAt: nowMs() + modeTurnMs(mode),
    winnerId: null,
    questions: [],
    awaitingHumanAnswer: null
  };
}

export function offlineAskQuestion(state: OfflineState, playerId: string, text: string) {
  if (state.winnerId) return state;
  if (playerId !== state.currentTurnPlayerId) return state;
  const qText = text.trim().slice(0, 120);
  if (!qText) return state;

  const questionId = randomId('q');
  const answers: any = {};
  for (const p of state.players) {
    if (p.id === playerId) continue;
    answers[p.id] = null;
  }

  const q: QuestionPublic = {
    id: questionId,
    askedBy: playerId,
    text: qText,
    createdAt: nowMs(),
    answers,
    yesCount: 0,
    noCount: 0
  };

  const next: OfflineState = { ...state, questions: [q, ...state.questions].slice(0, 20) };

  const asker = next.players.find((p) => p.id === playerId);
  if (asker?.isAi) {
    return { ...next, awaitingHumanAnswer: { questionId, askedById: playerId } };
  }

  const updated = next.questions[0];
  const meTarget = next.players.find((p) => p.id === playerId)?.target;
  if (!meTarget) return next;

  for (const p of next.players) {
    if (p.id === playerId) continue;
    const pred = questionToPredicate(qText);
    const ans: Answer = pred ? (pred(meTarget) ? 'YES' : 'NO') : 'NO';
    updated.answers[p.id] = ans;
  }

  updated.yesCount = Object.values(updated.answers).filter((a) => a === 'YES').length;
  updated.noCount = Object.values(updated.answers).filter((a) => a === 'NO').length;
  return { ...next, questions: [updated, ...next.questions.slice(1)] };
}

export function offlineHumanAnswer(state: OfflineState, questionId: string, answer: Answer) {
  const q = state.questions.find((x) => x.id === questionId);
  if (!q) return state;
  if (!state.awaitingHumanAnswer || state.awaitingHumanAnswer.questionId !== questionId) return state;

  const askerId = q.askedBy;
  const asker = state.players.find((p) => p.id === askerId);
  if (!asker || !asker.isAi) return state;

  if (!state.players.find((p) => p.id === askerId)?.character) return state;

  q.answers[state.players[0].id] = answer;
  q.yesCount = Object.values(q.answers).filter((a) => a === 'YES').length;
  q.noCount = Object.values(q.answers).filter((a) => a === 'NO').length;

  return { ...state, questions: [...state.questions], awaitingHumanAnswer: null };
}

export function offlineGuess(state: OfflineState, playerId: string, guessText: string) {
  if (state.winnerId) return state;
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return state;
  const correct = normalizeGuess(guessText) === normalizeGuess(p.target.name);
  if (correct) return { ...state, winnerId: playerId };
  return state;
}

export function offlineTick(state: OfflineState) {
  if (state.winnerId) return state;
  if (state.awaitingHumanAnswer) return state;
  if (nowMs() < state.turnEndsAt) {
    const current = state.players.find((p) => p.id === state.currentTurnPlayerId);
    if (current?.isAi) {
      const aiId = current.id;
      const candidates = aiCandidatesForSelf(state, aiId);
      if (candidates.length <= 2 && Math.random() < 0.7) {
        return offlineGuess(state, aiId, candidates[0]?.name ?? '');
      }
      const nextQ = aiPickQuestion(candidates);
      return offlineAskQuestion(state, aiId, nextQ);
    }
    return state;
  }

  const ids = state.players.map((p) => p.id);
  const idx = ids.indexOf(state.currentTurnPlayerId);
  const nextId = ids[(idx + 1 + ids.length) % ids.length];

  return {
    ...state,
    currentTurnPlayerId: nextId,
    turnEndsAt: nowMs() + state.turnMs
  };
}
