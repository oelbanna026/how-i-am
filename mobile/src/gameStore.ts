import { useSyncExternalStore } from 'react';
import { connectSocket, disconnectSocket, emitAck, getSocket, listenToEvents } from './socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProfile, resolveAvatar, saveProfile } from './profile';
import { NativeModules, Platform } from 'react-native';
import { offlineCards, offlineImageDataUri } from './offlineCards';
import { audioService } from './audio/audioService';
import { voiceService } from './audio/voiceService';

export type VoiceParticipant = {
  userId: string;
  micOn?: boolean;
  muted?: boolean;
  speaking?: boolean;
};

export type VoiceState = {
  roomId: string | null;
  participants: VoiceParticipant[];
};

export type Message = {
  id: string;
  ts: number;
  type: string;
  text: string;
  payload?: any;
};

export type GameStoreState = {
  serverUrl: string;
  connecting: boolean;
  connected: boolean;
  userId: string | null;
  sessionToken: string | null;
  error: string | null;
  currentRoom: any | null;
  players: any[];
  gameState: any | null;
  myCard: any | null;
  timer: { turnEndsAt: number | null; turnMs: number | null } | null;
  roundResult: any | null;
  recentGuesses: string[];
  recentPlayers: Array<{ id: string; name: string }>;
  blockedUserIds: string[];
  reportTargetUserId: string | null;
  ui: {
    language: 'ar' | 'en';
    sound: boolean;
    voice: boolean;
    haptics: boolean;
    reduceMotion: boolean;
    profanityFilter: boolean;
    accent: 'primary' | 'tertiary' | 'secondary' | 'error' | 'custom';
  };
  lastReaction: { emoji: string; fromId: string; fromName: string; ts: number } | null;
  lastToast: { text: string; ts: number } | null;
  profile: { name: string; avatarId: string; coins: number };
  unlockedCategories: string[];
  messages: Message[];
  voiceState: VoiceState;
};

type Listener = () => void;

function nowMs() {
  return Date.now();
}

function id() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

const CLIENT_ID_KEY = 'wai_client_id_v1';
const COINS_KEY = 'wai_coins_v1';
const UNLOCKED_CATEGORIES_KEY = 'wai_unlocked_categories_v1';
const BLOCKED_USERS_KEY = 'wai_blocked_users_v1';
const RECENT_PLAYERS_KEY = 'wai_recent_players_v1';
const UI_SETTINGS_KEY = 'wai_ui_settings_v1';
const SERVER_URL_KEY = 'wai_server_url_v1';

function guessDevHost() {
  try {
    const scriptURL = String((NativeModules as any)?.SourceCode?.scriptURL ?? '');
    const m = scriptURL.match(/^(?:https?|exp):\/\/([^/:]+)(?::(\d+))?\//i);
    const host = m?.[1] ?? '';
    if (!host) return null;
    if (host === 'localhost' || host === '127.0.0.1') return null;
    return host;
  } catch {
    return null;
  }
}

function defaultServerUrl() {
  const fromEnv = normalizeServerUrlInput((process.env.EXPO_PUBLIC_SERVER_URL as string | undefined) ?? '');
  if (fromEnv) return fromEnv;
  const host = guessDevHost();
  if (host) return `http://${host}:3002`;
  return 'https://how-i-am.onrender.com';
}

function toAssetUrl(serverUrl: string, imagePath: string | null | undefined) {
  const base = String(serverUrl ?? '').replace(/\/+$/, '');
  const p = String(imagePath ?? '').trim();
  if (!base || !p) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
}

function normalizeCardForClient(serverUrl: string, card: any) {
  if (!card) return null;
  const imagePath = typeof card.imagePath === 'string' ? card.imagePath : null;
  const imageUri = toAssetUrl(serverUrl, imagePath);
  if (!imageUri) return { ...card };
  return { ...card, imageUri };
}

function normalizeServerUrlInput(raw: string) {
  const s = String(raw ?? '');
  const idx = s.toLowerCase().indexOf('http://');
  const idx2 = s.toLowerCase().indexOf('https://');
  const start = idx === -1 ? idx2 : idx2 === -1 ? idx : Math.min(idx, idx2);
  if (start === -1) return '';

  const urlChars = /[a-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]/i;
  let out = '';
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (!urlChars.test(ch)) break;
    out += ch;
  }
  const candidate = out.trim();
  if (!/^https?:\/\//i.test(candidate)) return '';
  try {
    const u = new URL(candidate);
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

async function loadServerUrl() {
  const fromEnv = normalizeServerUrlInput((process.env.EXPO_PUBLIC_SERVER_URL as string | undefined) ?? '');
  if (fromEnv) return fromEnv;
  const raw = await AsyncStorage.getItem(SERVER_URL_KEY);
  const val = String(raw ?? '').trim();
  if (val) {
    const lower = val.toLowerCase();
    const isLocal =
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.startsWith('http://192.') ||
      lower.startsWith('http://10.') ||
      lower.startsWith('http://172.16.') ||
      lower.startsWith('http://172.17.') ||
      lower.startsWith('http://172.18.') ||
      lower.startsWith('http://172.19.') ||
      lower.startsWith('http://172.2') ||
      lower.startsWith('http://172.30.') ||
      lower.startsWith('http://172.31.');
    if (!isLocal) return val;
  }
  return defaultServerUrl();
}

async function saveServerUrl(url: string) {
  const raw = String(url ?? '').trim();
  const normalized = normalizeServerUrlInput(raw);
  const next = normalized || raw;
  await AsyncStorage.setItem(SERVER_URL_KEY, next);
}

async function ensureClientId() {
  const existing = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const created = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

async function loadCoins() {
  const raw = await AsyncStorage.getItem(COINS_KEY);
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n)) return n;
  await AsyncStorage.setItem(COINS_KEY, '100');
  return 100;
}

async function saveCoins(coins: number) {
  await AsyncStorage.setItem(COINS_KEY, String(Math.max(0, Math.floor(coins))));
}

async function loadUnlockedCategories() {
  const raw = await AsyncStorage.getItem(UNLOCKED_CATEGORIES_KEY);
  if (!raw) return ['All'];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
  } catch {}
  return ['All'];
}

async function saveUnlockedCategories(list: string[]) {
  await AsyncStorage.setItem(UNLOCKED_CATEGORIES_KEY, JSON.stringify(Array.from(new Set(list.map(String)))));
}

async function loadBlockedUsers() {
  const raw = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
  } catch {}
  return [];
}

async function saveBlockedUsers(list: string[]) {
  await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(Array.from(new Set(list.map(String))).filter(Boolean)));
}

async function loadRecentPlayers() {
  const raw = await AsyncStorage.getItem(RECENT_PLAYERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((x: any) => ({ id: String(x?.id ?? ''), name: String(x?.name ?? '') }))
        .filter((x) => x.id && x.name)
        .slice(0, 20);
    }
  } catch {}
  return [];
}

async function saveRecentPlayers(list: Array<{ id: string; name: string }>) {
  const safe = list
    .map((x) => ({ id: String(x.id ?? ''), name: String(x.name ?? '') }))
    .filter((x) => x.id && x.name)
    .slice(0, 20);
  await AsyncStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(safe));
}

async function loadUiSettings() {
  const raw = await AsyncStorage.getItem(UI_SETTINGS_KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      const language = p?.language === 'en' ? 'en' : 'ar';
      return {
        language,
        sound: Boolean(p?.sound ?? true),
        voice: Boolean(p?.voice ?? true),
        haptics: Boolean(p?.haptics ?? true),
        reduceMotion: Boolean(p?.reduceMotion ?? false),
        profanityFilter: Boolean(p?.profanityFilter ?? true),
        accent:
          p?.accent === 'tertiary' || p?.accent === 'secondary' || p?.accent === 'error' || p?.accent === 'custom'
            ? p.accent
            : 'primary'
      } as const;
    } catch {}
  }
  return { language: 'ar', sound: true, voice: true, haptics: true, reduceMotion: false, profanityFilter: true, accent: 'primary' } as const;
}

async function saveUiSettings(ui: GameStoreState['ui']) {
  await AsyncStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(ui));
}

async function serverGetProfile(serverUrl: string, playerId: string) {
  const base = String(serverUrl ?? '').replace(/\/+$/, '');
  if (!base || !playerId) throw new Error('MISSING_SERVER_OR_PLAYER');
  const res = await fetch(`${base}/profile/${encodeURIComponent(playerId)}`);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(String(json?.error ?? 'PROFILE_FETCH_FAILED'));
  return json.profile as any;
}

async function serverPatchProfile(serverUrl: string, playerId: string, patch: any) {
  const base = String(serverUrl ?? '').replace(/\/+$/, '');
  if (!base || !playerId) throw new Error('MISSING_SERVER_OR_PLAYER');
  const res = await fetch(`${base}/profile/${encodeURIComponent(playerId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch ?? {})
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(String(json?.error ?? 'PROFILE_UPDATE_FAILED'));
  return json.profile as any;
}

function buildTimerFromPayload(p: any) {
  const t = p?.timer;
  if (!t) return null;
  const endsAt = typeof t.turnEndsAt === 'number' ? t.turnEndsAt : null;
  const ms = typeof t.turnMs === 'number' ? t.turnMs : null;
  return { turnEndsAt: endsAt, turnMs: ms };
}

function upsertVoiceParticipant(state: VoiceState, patch: VoiceParticipant) {
  const list = [...state.participants];
  const idx = list.findIndex((p) => p.userId === patch.userId);
  if (idx >= 0) list[idx] = { ...list[idx], ...patch };
  else list.push(patch);
  return { ...state, participants: list };
}

function removeVoiceParticipant(state: VoiceState, userId: string) {
  return { ...state, participants: state.participants.filter((p) => p.userId !== userId) };
}

function pickOfflineCard(category: string) {
  const c = String(category ?? '').toLowerCase();
  const pool = c && c !== 'all' ? offlineCards.filter((x) => String(x.category) === c) : offlineCards.slice();
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function isOfflineRoom(room: any | null) {
  return String(room?.roomCode ?? '') === 'OFFLINE';
}

let offlineClock: any = null;

function stopOfflineClock() {
  if (offlineClock) clearInterval(offlineClock);
  offlineClock = null;
}

function startOfflineClock() {
  if (offlineClock) return;
  offlineClock = setInterval(() => {
    const s = store.getState();
    const offline = isOfflineRoom(s.currentRoom);
    if (!offline) {
      stopOfflineClock();
      return;
    }
    const g = s.gameState;
    if (!g || g.flow !== 'playing') return;
    const turnMs = Number(g.turnMs ?? s.timer?.turnMs ?? 180000) || 180000;
    const now = Date.now();
    const endsAt = typeof g.timer?.turnEndsAt === 'number' ? g.timer.turnEndsAt : now + turnMs;
    let nextEndsAt = endsAt;
    let extended = false;
    if (now >= endsAt) {
      nextEndsAt = now + turnMs;
      extended = true;
    }
    store.setState((st) => ({
      timer: { turnEndsAt: nextEndsAt, turnMs },
      gameState: st.gameState
        ? {
            ...st.gameState,
            timer: { turnEndsAt: nextEndsAt, turnMs },
            offline: { ...(st.gameState as any).offline, now, extended }
          }
        : st.gameState,
      messages: extended
        ? [{ id: id(), ts: nowMs(), type: 'timer', text: 'تم تمديد الوقت', payload: { turnMs } }, ...st.messages].slice(0, 100)
        : st.messages
    }));
  }, 1000);
}

function normalizeArabicQuestion(text: string) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[؟?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArabicGuess(text: string) {
  return normalizeArabicQuestion(text)
    .replace(/^انا\s+/i, '')
    .replace(/^i am\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyQuestion(text: string) {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  if (raw.includes('?') || raw.includes('؟')) return true;
  const q = normalizeArabicQuestion(raw);
  const any = (arr: string[]) => arr.some((x) => q.includes(normalizeArabicQuestion(x)));
  return any([
    'هل',
    'موجود',
    'في البيت',
    'بالبيت',
    'في المطبخ',
    'بالمطبخ',
    'يتاكل',
    'بيتاكل',
    'بيتكل',
    'بيتآكل',
    'تتاكل',
    'فاكهة',
    'خضار',
    'خضروات',
    'حيوان',
    'جماد',
    'شيء',
    'اداة',
    'اكل',
    'أكل',
    'طعام',
    'وجبة',
    'حي',
    'عايش',
    'بيتحرك',
    'عجلات',
    'بينور',
    'لمبة',
    'مصباح',
    'تلفزيون',
    'قنوات',
    'لاب توب',
    'كمبيوتر',
    'حاسوب',
    'منبه',
    'ساعة',
    'كرسي',
    'ترابيزة',
    'طاولة'
  ]);
}

function offlineTruthAnswer(card: any, questionText: string) {
  const q = normalizeArabicQuestion(questionText);
  const cat = String(card?.category ?? '').toLowerCase();
  const slug = String(card?.slug ?? '').toLowerCase();
  const name = String(card?.name ?? '');

  const has = (s: string) => q.includes(normalizeArabicQuestion(s));
  const any = (arr: string[]) => arr.some((x) => has(x));

  if (any(['فاكهة'])) return cat === 'fruit';
  if (any(['خضار', 'خضروات'])) return cat === 'vegetable';
  if (any(['اكل', 'أكل', 'طعام', 'وجبة', 'أكله', 'أكلة'])) return cat === 'food';
  if (any(['حيوان'])) return cat === 'animal';
  if (any(['جماد', 'شيء', 'أداة'])) return cat === 'object';

  if (any(['يتاكل', 'بيتاكل', 'بيتكل', 'مأكول', 'بتتاكل', 'تتاكل'])) return cat === 'fruit' || cat === 'vegetable' || cat === 'food';
  if (any(['في المطبخ', 'بالمطبخ'])) return cat === 'fruit' || cat === 'vegetable' || cat === 'food' || slug === 'table';
  if (any(['في البيت', 'بالبيت', 'موجود في البيت', 'موجود بالبيت'])) {
    if (cat === 'animal') return ['cat', 'dog', 'rabbit'].includes(slug) || name.includes('قطة') || name.includes('كلب') || name.includes('أرنب');
    return true;
  }
  if (any(['حي', 'عايش', 'بيتحرك'])) return cat === 'animal';

  if (any(['له عجلات', 'بعجلات'])) return slug === 'car' || name.includes('عربية');
  if (any(['بينور', 'ينور', 'لمبة', 'مصباح'])) return slug === 'light_bulb' || name.includes('لمبة');
  if (any(['تلفزيون', 'قنوات'])) return slug === 'tv' || name.includes('تلفزيون');
  if (any(['لاب توب', 'كمبيوتر', 'حاسوب'])) return slug === 'laptop' || name.includes('لاب');
  if (any(['منبه', 'ساعة'])) return slug === 'alarm_clock' || name.includes('ساعة');
  if (any(['بنقعد', 'للجلوس', 'كرسي'])) return slug === 'chair' || name.includes('كرسي');
  if (any(['ترابيزة', 'طاولة', 'عليه', 'بنحط'])) return slug === 'table' || name.includes('ترابيزة');

  return false;
}

function offlineEval(card: any, questionText: string): boolean | null {
  const q = normalizeArabicQuestion(questionText);
  const cat = String(card?.category ?? '').toLowerCase();
  const slug = String(card?.slug ?? '').toLowerCase();
  const name = String(card?.name ?? '');

  const has = (s: string) => q.includes(normalizeArabicQuestion(s));
  const any = (arr: string[]) => arr.some((x) => has(x));

  if (any(['فاكهة'])) return cat === 'fruit';
  if (any(['خضار', 'خضروات'])) return cat === 'vegetable';
  if (any(['اكل', 'أكل', 'طعام', 'وجبه', 'اكله', 'اكله'])) return cat === 'food';
  if (any(['حيوان'])) return cat === 'animal';
  if (any(['جماد', 'شيء', 'اداه'])) return cat === 'object';

  if (any(['يتاكل', 'بيتاكل', 'بيتكل', 'مأكول', 'بتتاكل', 'تتاكل'])) return cat === 'fruit' || cat === 'vegetable' || cat === 'food';
  if (any(['في المطبخ', 'بالمطبخ'])) return cat === 'fruit' || cat === 'vegetable' || cat === 'food' || slug === 'table';
  if (any(['في البيت', 'بالبيت', 'موجود في البيت', 'موجود بالبيت'])) {
    if (cat === 'animal') return ['cat', 'dog', 'rabbit'].includes(slug) || name.includes('قطة') || name.includes('كلب') || name.includes('أرنب');
    return true;
  }
  if (any(['حي', 'عايش', 'بيتحرك'])) return cat === 'animal';

  if (cat === 'animal') {
    const legs2 = ['penguin', 'monkey'].includes(slug);
    const legs4 = !legs2;
    const domestic = ['cat', 'dog', 'rabbit'].includes(slug);
    const fierce = ['lion', 'tiger'].includes(slug);
    const canSwim = ['penguin'].includes(slug);
    const big = ['elephant', 'giraffe'].includes(slug);

    if (any(['رجلين', 'رجليين', '٢', '2'])) return legs2;
    if (any(['اربعه', 'اربع', '٤', '4', 'اربع رجل'])) return legs4;
    if (any(['اليف', 'منزلي', 'بيتربي'])) return domestic;
    if (any(['شرس', 'مفترس', 'خطير'])) return fierce;
    if (any(['يسبح', 'ماء', 'بحر'])) return canSwim;
    if (any(['كبير', 'ضخم'])) return big;
    if (any(['صغير'])) return !big;
  }

  if (any(['له عجلات', 'بعجلات'])) return slug === 'car' || name.includes('عربية');
  if (any(['بينور', 'ينور', 'لمبه', 'مصباح'])) return slug === 'light_bulb' || name.includes('لمبة');
  if (any(['تلفزيون', 'قنوات'])) return slug === 'tv' || name.includes('تلفزيون');
  if (any(['لاب توب', 'كمبيوتر', 'حاسوب'])) return slug === 'laptop' || name.includes('لاب');
  if (any(['منبه', 'ساعه'])) return slug === 'alarm_clock' || name.includes('ساعة');
  if (any(['بنقعد', 'للجلوس', 'كرسي'])) return slug === 'chair' || name.includes('كرسي');
  if (any(['ترابيزة', 'طاولة', 'عليه', 'بنحط'])) return slug === 'table' || name.includes('ترابيزة');
  if (any(['شاشه', 'شاشة'])) return slug === 'tv' || slug === 'laptop' || name.includes('تلفزيون') || name.includes('لاب');

  return null;
}

function offlineTruthAnswerStrict(card: any, questionText: string) {
  const v = offlineEval(card, questionText);
  return v === null ? false : v;
}

function offlinePickAiQuestion(candidates: any[], askedKeys: string[], recentKeys: string[], lastQuestionText?: string | null) {
  const pool = Array.isArray(candidates) ? candidates : [];
  const askedSet = new Set((askedKeys ?? []).map((x) => normalizeArabicQuestion(x)));
  const recentSet = new Set((recentKeys ?? []).map((x) => normalizeArabicQuestion(x)));
  const lastKey = lastQuestionText ? normalizeArabicQuestion(lastQuestionText) : null;
  const questions = [
    'أنا بيتاكل؟',
    'أنا فاكهة؟',
    'أنا خضار؟',
    'أنا أكل؟',
    'أنا حيوان؟',
    'أنا جماد؟',
    'موجود في البيت؟',
    'موجود في المطبخ؟',
    'أنا أليف؟',
    'أنا شرس؟',
    'عندي رجلين؟',
    'عندي 4 رجل؟',
    'أنا كبير؟',
    'أنا بسبح؟',
    'عندي عجلات؟',
    'عندي شاشة؟'
  ];

  function scoreQuestion(q: string) {
    const n = pool.length || 1;
    let yes = 0;
    let no = 0;
    for (const c of pool) {
      const v = offlineEval(c, q);
      if (v === true) yes += 1;
      else if (v === false) no += 1;
    }
    const known = yes + no;
    if (known < Math.max(3, Math.floor(n * 0.3))) return -1;
    const split = Math.abs(yes - no) / known;
    return 1 - split;
  }

  function pickBest(allowAsked: boolean) {
    let best = null;
    let bestScore = -1;
    for (const q of questions) {
      const key = normalizeArabicQuestion(q);
      if (lastKey && key === lastKey) continue;
      if (recentSet.has(key)) continue;
      if (!allowAsked && askedSet.has(key)) continue;
      const s = scoreQuestion(q);
      if (s < 0.05) continue;
      if (s > bestScore) {
        bestScore = s;
        best = q;
      }
    }
    return best;
  }

  const unasked = pickBest(false);
  if (unasked) return unasked;
  const anyQ = pickBest(true);
  if (anyQ) return anyQ;
  return lastQuestionText && normalizeArabicQuestion(lastQuestionText) !== normalizeArabicQuestion(questions[0]) ? questions[0] : questions[1] ?? questions[0];
}

function offlineApplyAnswerToCandidates(candidates: any[], questionText: string, answer: 'YES' | 'NO') {
  const wantYes = answer === 'YES';
  const out = [];
  for (const c of candidates) {
    const v = offlineEval(c, questionText);
    if (v === null) {
      out.push(c);
      continue;
    }
    if (v === wantYes) out.push(c);
  }
  return out;
}

function pickDistinctOfflineCards() {
  const a = pickOfflineCard('all');
  if (!a) return { userCard: null, botCard: null };
  let b = pickOfflineCard('all');
  let tries = 0;
  while (b && a && String(b.slug) === String(a.slug) && tries < 10) {
    b = pickOfflineCard('all');
    tries += 1;
  }
  return { userCard: a, botCard: b && String(b.slug) !== String(a.slug) ? b : null };
}

class Store {
  state: GameStoreState;
  listeners = new Set<Listener>();

  constructor() {
    this.state = {
      serverUrl: defaultServerUrl(),
      connecting: false,
      connected: false,
      userId: null,
      sessionToken: null,
      error: null,
      currentRoom: null,
      players: [],
      gameState: null,
      myCard: null,
      timer: null,
      roundResult: null,
      recentGuesses: [],
      recentPlayers: [],
      blockedUserIds: [],
      reportTargetUserId: null,
      ui: { language: 'ar', sound: true, voice: true, haptics: true, reduceMotion: false, profanityFilter: true, accent: 'primary' },
      lastReaction: null,
      lastToast: null,
      profile: { name: 'Guest', avatarId: 'a1', coins: 100 },
      unlockedCategories: ['All'],
      messages: [],
      voiceState: { roomId: null, participants: [] }
    };
  }

  getState = () => this.state;

  setState = (patch: Partial<GameStoreState> | ((s: GameStoreState) => Partial<GameStoreState>)) => {
    const nextPatch = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...nextPatch };
    for (const l of this.listeners) l();
  };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

const store = new Store();

export function useGameStore<T>(selector: (s: GameStoreState) => T) {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export const gameActions = {
  async setServerUrl(url: string) {
    const raw = String(url ?? '').trim();
    const normalized = normalizeServerUrlInput(raw);
    const next = normalized || raw;
    store.setState({ serverUrl: next });
    await saveServerUrl(next);
  },

  async connectSocket() {
    let url = store.getState().serverUrl || (await loadServerUrl());
    if (String(url).includes('how-i-am.onrender.com')) url = 'https://how-i-am.onrender.com';
    const normalized = normalizeServerUrlInput(url);
    if (normalized) url = normalized;
    if (!store.getState().serverUrl || store.getState().serverUrl !== url) {
      store.setState({ serverUrl: url });
      await saveServerUrl(url);
    }
    store.setState({ connecting: true, error: null });
    try {
      const userId = await ensureClientId();
      const [p, coins, unlockedCategories, blockedUserIds, recentPlayers, ui] = await Promise.all([
        loadProfile(),
        loadCoins(),
        loadUnlockedCategories(),
        loadBlockedUsers(),
        loadRecentPlayers(),
        loadUiSettings()
      ]);
      await connectSocket(url);
      const s = getSocket();
      store.setState({ connecting: false, connected: Boolean(s?.connected), userId });
      store.setState({
        profile: { name: p.name, avatarId: p.avatar.id, coins },
        unlockedCategories,
        blockedUserIds,
        recentPlayers,
        ui
      });

      try {
        const remote = await serverGetProfile(url, userId);
        if (remote?.name) {
          store.setState((s) => ({ profile: { ...s.profile, name: String(remote.name).slice(0, 16) || s.profile.name } }));
          await saveProfile({ name: String(remote.name).slice(0, 16) || p.name });
        }
        if (remote?.avatarId) {
          const av = resolveAvatar(String(remote.avatarId));
          store.setState((s) => ({ profile: { ...s.profile, avatarId: av.id } }));
          await saveProfile({ avatar: av });
        }
        if (remote?.ui && typeof remote.ui === 'object') {
          const nextUi = { ...store.getState().ui, ...remote.ui } as any;
          store.setState({ ui: nextUi });
          await saveUiSettings(nextUi);
        }
        if (Array.isArray(remote?.blockedUserIds)) {
          const nextBlocked = remote.blockedUserIds.map((x: any) => String(x)).filter(Boolean);
          store.setState({ blockedUserIds: nextBlocked });
          await saveBlockedUsers(nextBlocked);
        }
      } catch {}
      listenToEvents({
        onConnect: () => {
          store.setState({ connected: true });
          void (async () => {
            const s = store.getState();
            const code = String((s.currentRoom as any)?.roomCode ?? (s.currentRoom as any)?.code ?? '').trim().toUpperCase();
            const userId = String(s.userId ?? '').trim();
            const sessionToken = String(s.sessionToken ?? '').trim();
            if (!code || code === 'OFFLINE') return;
            if (!userId || !sessionToken) return;
            try {
              await emitAck('joinRoom', { code, userId, name: s.profile.name, sessionToken });
            } catch (e: any) {
              const msg = String(e?.message ?? e);
              if (msg === 'ALREADY_IN_ROOM') return;
              if (msg === 'ROOM_NOT_FOUND' || msg === 'RECONNECT_WINDOW_EXPIRED' || msg === 'INVALID_SESSION') {
                store.setState({
                  currentRoom: null,
                  players: [],
                  gameState: null,
                  myCard: null,
                  timer: null,
                  roundResult: null,
                  sessionToken: null,
                  error: msg
                });
                return;
              }
            }
          })();
        },
        onDisconnect: () => store.setState({ connected: false }),
        onRoomUpdate: (payload) => {
          const blocked = new Set(store.getState().blockedUserIds.map(String));
          const nextPlayers = (payload?.players ?? []).filter((pl: any) => !blocked.has(String(pl?.id ?? '')));
          const seen = nextPlayers.map((p: any) => ({ id: String(p.id ?? ''), name: String(p.name ?? '') })).filter((x: any) => x.id && x.name);
          const merged = [
            ...seen,
            ...store
              .getState()
              .recentPlayers.filter((x) => !seen.some((y: any) => String(y.id) === String(x.id)))
          ].slice(0, 20);
          store.setState({
            currentRoom: payload,
            players: nextPlayers,
            timer: buildTimerFromPayload(payload) ?? store.getState().timer,
            recentPlayers: merged
          });
          void saveRecentPlayers(merged).catch(() => null);
        },
        onGameStart: (payload) => {
          const myId = store.getState().userId;
          const url = store.getState().serverUrl;
          const myCard =
            payload?.myCard ??
            payload?.players?.find?.((p: any) => p?.id === myId)?.card ??
            null;
          const normalizedPlayers = Array.isArray(payload?.players)
            ? payload.players.map((p: any) => ({ ...p, card: normalizeCardForClient(url, p?.card ?? null) }))
            : payload?.players;
          const normalizedPayload = { ...payload, players: normalizedPlayers, myCard: normalizeCardForClient(url, myCard) };
          store.setState({
            gameState: normalizedPayload,
            myCard: normalizeCardForClient(url, myCard),
            timer: buildTimerFromPayload(payload),
            messages: [
              { id: id(), ts: nowMs(), type: 'gameStart', text: 'Game started', payload },
              ...store.getState().messages
            ].slice(0, 100)
          });
          void audioService.playSFX('game_start').catch(() => null);
        },
        onTurnUpdate: (payload) => {
          const url = store.getState().serverUrl;
          const normalizedPlayers = Array.isArray(payload?.players)
            ? payload.players.map((p: any) => ({ ...p, card: normalizeCardForClient(url, p?.card ?? null) }))
            : payload?.players;
          const normalizedPayload = { ...payload, players: normalizedPlayers };
          store.setState({
            gameState: normalizedPayload,
            timer: buildTimerFromPayload(payload),
            players: normalizedPlayers ?? store.getState().players,
            roundResult: null,
            lastToast: null
          });
        },
        onQuestionReceived: (payload) => {
          store.setState((s) => {
            const q = payload?.question ?? null;
            const qid = String(q?.id ?? '');
            const prev = s.gameState;
            const prevQs = Array.isArray((prev as any)?.questions) ? (prev as any).questions : [];
            const nextQs = qid ? [q, ...prevQs.filter((x: any) => String(x?.id ?? '') !== qid)] : prevQs;
            return {
              ...s,
              gameState: prev ? { ...(prev as any), questions: nextQs } : prev,
              roundResult: null,
              messages: [{ id: id(), ts: nowMs(), type: 'question', text: q?.text ?? 'Question', payload: q }, ...s.messages].slice(0, 100)
            };
          });
        },
        onAnswerResult: (payload) => {
          store.setState((s) => {
            const prev = s.gameState;
            const qid = String(payload?.questionId ?? '');
            const prevQs = Array.isArray((prev as any)?.questions) ? (prev as any).questions : [];
            const nextQs = qid
              ? prevQs.map((q: any) => {
                  if (String(q?.id ?? '') !== qid) return q;
                  return {
                    ...q,
                    answers: payload?.answers ?? q?.answers,
                    majority: payload?.majority ?? q?.majority,
                    yesCount: payload?.yesCount ?? q?.yesCount,
                    noCount: payload?.noCount ?? q?.noCount
                  };
                })
              : prevQs;

            const meId = String(s.userId ?? '');
            const answeredBy = String(payload?.answeredBy ?? '');
            const updatedQ = qid ? nextQs.find((q: any) => String(q?.id ?? '') === qid) : null;
            const askedBy = String(updatedQ?.askedBy ?? '');
            const isMeAnswerer = meId && answeredBy && meId === answeredBy;
            const isMeAsker = meId && askedBy && meId === askedBy;
            const majority = String(payload?.majority ?? '');
            const majorityAr = majority === 'YES' ? 'أيوه' : majority === 'NO' ? 'لأ' : null;
            const toastText =
              isMeAnswerer ? 'تم إرسال إجابتك' : payload?.complete && isMeAsker && majorityAr ? `إجابة الخصم: ${majorityAr}` : null;

            return {
              ...s,
              gameState: prev
                ? {
                    ...(prev as any),
                    scores: payload?.scores ?? (prev as any).scores,
                    questions: nextQs
                  }
                : prev,
              roundResult: null,
              lastToast: toastText ? { text: toastText, ts: nowMs() } : s.lastToast,
              messages: [
                {
                  id: id(),
                  ts: nowMs(),
                  type: 'answer',
                  text: payload?.complete ? `Majority: ${payload?.majority ?? 'TIE'}` : 'Answer received',
                  payload
                },
                ...s.messages
              ].slice(0, 100)
            };
          });
        },
        onReaction: (payload) => {
          const fromId = String(payload?.userId ?? '');
          const emoji = String(payload?.emoji ?? '').trim();
          if (!fromId || !emoji) return;
          store.setState((s) => {
            const fromName =
              s.players.find((p: any) => String(p?.id ?? '') === fromId)?.name ??
              s.recentPlayers.find((p: any) => String(p?.id ?? '') === fromId)?.name ??
              fromId.slice(0, 4);
            return {
              ...s,
              lastReaction: { emoji, fromId, fromName, ts: Number(payload?.ts ?? nowMs()) || nowMs() },
              messages: [{ id: id(), ts: nowMs(), type: 'reaction', text: `${fromName} ${emoji}`, payload }, ...s.messages].slice(0, 100)
            };
          });
        },
        onGuessResult: (payload) => {
          void audioService.playSFX(payload?.correct ? 'correct_guess' : 'wrong_guess').catch(() => null);
          void voiceService.playVoice(payload?.correct ? 'correct' : 'wrong');
          store.setState((s) => {
            const pid = String(payload?.playerId ?? '');
            const winnerName = s.players.find((p: any) => String(p.id) === pid)?.name ?? 'حد';
            const meId = String(s.userId ?? '');
            const correct = Boolean(payload?.correct);
            const toastText = correct
              ? pid && meId && pid === meId
                ? 'تخمين صحيح!'
                : `${winnerName} عرف الإجابة!`
              : pid && meId && pid === meId
                ? 'تخمين غلط'
                : `${winnerName} خمن غلط`;
            const targetName = typeof payload?.target?.name === 'string' ? payload.target.name : null;
            const targetImagePath = typeof payload?.target?.imagePath === 'string' ? payload.target.imagePath : null;
            const imageUri = targetImagePath ? toAssetUrl(s.serverUrl, targetImagePath) : null;
            return {
              ...s,
              gameState: s.gameState ? { ...(s.gameState as any), scores: payload?.scores ?? (s.gameState as any).scores } : s.gameState,
              lastToast: { text: toastText, ts: nowMs() },
              roundResult:
                correct && targetName
                  ? {
                      kind: 'guess',
                      winnerId: pid || null,
                      winnerName,
                      identity: targetName,
                      pointsDelta: payload?.scoreDelta ?? null,
                      imageUri
                    }
                  : null,
              messages: [{ id: id(), ts: nowMs(), type: 'guess', text: correct ? 'Correct guess' : 'Wrong guess', payload }, ...s.messages].slice(0, 100)
            };
          });
        },
        onGameEnd: (payload) => {
          try {
            const me = store.getState().userId;
            const winnerId = payload?.winnerId ?? store.getState().gameState?.winnerId ?? null;
            if (winnerId && me && String(winnerId) === String(me)) void audioService.playSFX('win').catch(() => null);
            else void audioService.playSFX('lose').catch(() => null);
          } catch {}
          store.setState({
            gameState: store.getState().gameState
              ? {
                  ...store.getState().gameState,
                  flow: 'ended',
                  winnerId: payload?.winnerId ?? store.getState().gameState?.winnerId ?? null,
                  scoreboard: payload?.scoreboard ?? store.getState().gameState?.scoreboard ?? null,
                  endReason: payload?.reason ?? store.getState().gameState?.endReason ?? null
                }
              : { flow: 'ended', winnerId: payload?.winnerId ?? null, scoreboard: payload?.scoreboard ?? null, endReason: payload?.reason ?? null },
            messages: [
              { id: id(), ts: nowMs(), type: 'gameEnd', text: 'Game ended', payload },
              ...store.getState().messages
            ].slice(0, 100)
          });
        },
        onUserJoinedVoice: (payload) => {
          const roomId = String(payload?.roomId ?? '');
          const userId = String(payload?.userId ?? '');
          if (!roomId || !userId) return;
          store.setState((s) => ({ voiceState: upsertVoiceParticipant({ ...s.voiceState, roomId }, { userId }) }));
        },
        onUserLeftVoice: (payload) => {
          const roomId = String(payload?.roomId ?? '');
          const userId = String(payload?.userId ?? '');
          if (!roomId || !userId) return;
          store.setState((s) => ({ voiceState: removeVoiceParticipant({ ...s.voiceState, roomId }, userId) }));
        },
        onUserMuted: (payload) => {
          const roomId = String(payload?.roomId ?? '');
          const userId = String(payload?.userId ?? '');
          if (!roomId || !userId) return;
          store.setState((s) => ({
            voiceState: upsertVoiceParticipant(
              { ...s.voiceState, roomId },
              { userId, muted: payload?.muted, micOn: payload?.micOn }
            )
          }));
        },
        onUserSpeaking: (payload) => {
          const roomId = String(payload?.roomId ?? '');
          const userId = String(payload?.userId ?? '');
          if (!roomId || !userId) return;
          store.setState((s) => ({
            voiceState: upsertVoiceParticipant({ ...s.voiceState, roomId }, { userId, speaking: Boolean(payload?.speaking) })
          }));
        }
      });
    } catch (e: any) {
      store.setState({ connecting: false, connected: false, error: String(e?.message ?? e) });
      throw e;
    }
  },

  disconnectSocket() {
    disconnectSocket();
    store.setState({
      connected: false,
      connecting: false,
      sessionToken: null,
      currentRoom: null,
      players: [],
      gameState: null,
      myCard: null,
      timer: null,
      roundResult: null,
      recentGuesses: [],
      reportTargetUserId: null,
      voiceState: { roomId: null, participants: [] }
    });
  },

  async createRoom(args: { name?: string; mode?: string; category?: string }) {
    if (!getSocket()?.connected) await gameActions.connectSocket();
    const userId = store.getState().userId;
    if (!userId) throw new Error('MISSING_USER_ID');
    const fallbackName = store.getState().profile.name;
    const res = await emitAck<{ roomCode: string; sessionToken: string; voice?: any }>('createRoom', { ...args, userId });
    void audioService.playSFX('join_room').catch(() => null);
    store.setState((s) => ({
      messages: [{ id: id(), ts: nowMs(), type: 'room', text: `Created room ${res.roomCode}`, payload: res }, ...s.messages].slice(0, 100),
      voiceState: res.voice?.state ? { roomId: res.roomCode, participants: res.voice.state.participants ?? [] } : s.voiceState,
      sessionToken: res.sessionToken
    }));
    return res.roomCode;
  },

  async joinRoom(code: string, name?: string) {
    if (!getSocket()?.connected) await gameActions.connectSocket();
    const userId = store.getState().userId;
    if (!userId) throw new Error('MISSING_USER_ID');
    const fallbackName = store.getState().profile.name;
    const res = await emitAck<{ roomCode: string; sessionToken: string; voice?: any }>('joinRoom', {
      code,
      name: name ?? fallbackName,
      userId,
      sessionToken: store.getState().sessionToken
    });
    void audioService.playSFX('join_room').catch(() => null);
    store.setState((s) => ({
      messages: [{ id: id(), ts: nowMs(), type: 'room', text: `Joined room ${res.roomCode}`, payload: res }, ...s.messages].slice(0, 100),
      voiceState: res.voice?.state ? { roomId: res.roomCode, participants: res.voice.state.participants ?? [] } : s.voiceState,
      sessionToken: res.sessionToken
    }));
    return res.roomCode;
  },

  async leaveRoom() {
    if (isOfflineRoom(store.getState().currentRoom) || !getSocket()?.connected) {
      stopOfflineClock();
      store.setState({
        currentRoom: null,
        players: [],
        gameState: null,
        myCard: null,
        timer: null,
        voiceState: { roomId: null, participants: [] },
        sessionToken: null,
        roundResult: null
      });
      return;
    }
    await emitAck('leaveRoom');
    store.setState({
      currentRoom: null,
      players: [],
      gameState: null,
      myCard: null,
      timer: null,
      voiceState: { roomId: null, participants: [] },
      sessionToken: null,
      roundResult: null
    });
  },

  async startGame() {
    await emitAck('startGame');
    void audioService.playSFX('game_start').catch(() => null);
  },

  async setReady(ready: boolean) {
    await emitAck('setReady', { ready });
    void audioService.playSFX('player_ready').catch(() => null);
  },

  async sendReaction(emoji: string) {
    const e = String(emoji ?? '').trim().slice(0, 4);
    if (!e) return;
    if (isOfflineRoom(store.getState().currentRoom)) {
      store.setState((s) => ({
        lastReaction: { emoji: e, fromId: String(s.userId ?? ''), fromName: String(s.profile.name ?? 'You'), ts: nowMs() },
        messages: [{ id: id(), ts: nowMs(), type: 'reaction', text: e, payload: { emoji: e } }, ...s.messages].slice(0, 100)
      }));
      return;
    }
    await emitAck('sendReaction', { emoji: e });
  },

  async startOfflineGame() {
    const userId = store.getState().userId ?? (await ensureClientId());
    if (!store.getState().userId) store.setState({ userId });
    disconnectSocket();
    const meName = store.getState().profile.name || 'Guest';
    const botId = 'bot_ai_1';
    const botName = 'AI Bot';
    const { userCard, botCard } = pickDistinctOfflineCards();
    const userImg = await offlineImageDataUri(userCard?.imagePath ?? null);
    const botImg = await offlineImageDataUri(botCard?.imagePath ?? null);
    const myCard = userCard
      ? { name: userCard.name, slug: userCard.slug, category: userCard.category, imagePath: userCard.imagePath, imageUri: userImg }
      : { name: '—', category: 'All', imagePath: null, imageUri: null };

    stopOfflineClock();
    const turnMs = 180000;
    const now = Date.now();
    store.setState({
      connected: false,
      connecting: false,
      sessionToken: null,
      currentRoom: {
        roomCode: 'OFFLINE',
        roomName: 'Offline AI',
        hostId: userId,
        maxPlayers: 2,
        flow: 'waiting',
        mode: 'Classic',
        category: 'All',
        isPublic: false
      },
      players: [
        { id: userId, name: meName, ready: true, connected: true, score: 0 },
        { id: botId, name: botName, ready: true, connected: true, score: 0 }
      ],
      myCard,
      timer: { turnEndsAt: now + turnMs, turnMs },
      gameState: {
        flow: 'playing',
        currentTurn: userId,
        turnMs,
        timer: { turnEndsAt: now + turnMs, turnMs },
        questions: [],
        scores: { [userId]: 0, [botId]: 0 },
        offline: {
          waiting: false,
          lastQuestionId: null,
          lastAnswer: null,
          now,
          extended: false,
          round: 1,
          maxRounds: 30,
          aiAsked: [],
          aiRecent: [],
          aiLastQuestionText: null,
          botCard: botCard
            ? { name: botCard.name, slug: botCard.slug, category: botCard.category, imagePath: botCard.imagePath, imageUri: botImg }
            : null,
          aiCandidates: offlineCards.map((c) => ({ category: c.category, slug: c.slug, name: c.name, imagePath: c.imagePath }))
        }
      },
      roundResult: null
    });
    startOfflineClock();
  },

  async sendQuestion(text: string) {
    if (isOfflineRoom(store.getState().currentRoom)) {
      const userId = store.getState().userId ?? '';
      const botId = 'bot_ai_1';
      const botName = 'AI Bot';
      const game = store.getState().gameState;
      if (!userId || !game) return;
      if (String(game.currentTurn) !== String(userId)) return;

      if (!isLikelyQuestion(text)) {
        const candidate = normalizeArabicGuess(text);
        if (!candidate) return;
        await gameActions.makeGuess(candidate);
        return;
      }
      const qid = id();
      const question = { id: qid, text: String(text), askedBy: userId, answers: { [botId]: null }, majority: null };
      store.setState((s) => ({
        gameState: s.gameState
          ? {
              ...s.gameState,
              questions: [question, ...(s.gameState.questions ?? [])],
              offline: {
                ...(s.gameState as any).offline,
                waiting: true,
                lastQuestionId: qid,
                lastAnswer: null,
                lastGuess: null,
                lastGuessCorrect: null,
                round: Math.min(((s.gameState as any).offline?.maxRounds ?? 6), (((s.gameState as any).offline?.round ?? 1) + 1))
              }
            }
          : s.gameState,
        messages: [{ id: id(), ts: nowMs(), type: 'question', text: 'Question sent', payload: question }, ...s.messages].slice(0, 100)
      }));
      setTimeout(() => {
        const truth = offlineTruthAnswerStrict(store.getState().myCard, text);
        const ans = truth ? 'YES' : 'NO';
        store.setState((s) => {
          if (!s.gameState) return s;
          const qs = Array.isArray(s.gameState.questions) ? s.gameState.questions : [];
          const updated = qs.map((q: any) => {
            if (String(q.id) !== qid) return q;
            return { ...q, answers: { ...(q.answers ?? {}), [botId]: ans }, majority: ans };
          });
          return {
            ...s,
            gameState: {
              ...s.gameState,
              questions: updated,
              offline: { ...(s.gameState as any).offline, waiting: false, lastQuestionId: qid, lastAnswer: ans }
            },
            messages: [
              { id: id(), ts: nowMs(), type: 'aiAnswer', text: ans === 'YES' ? 'AI: YES' : 'AI: NO', payload: { questionId: qid, answer: ans } },
              ...s.messages
            ].slice(0, 100)
          };
        });

        setTimeout(() => {
          const st = store.getState();
          const g2 = st.gameState;
          if (!g2 || !isOfflineRoom(st.currentRoom)) return;
          const off = (g2 as any).offline ?? {};
          const candidates = Array.isArray(off.aiCandidates) ? off.aiCandidates : offlineCards;
          const askedKeys = Array.isArray(off.aiAsked) ? off.aiAsked : [];
          const recentKeys = Array.isArray(off.aiRecent) ? off.aiRecent : [];
          const botQuestionText = offlinePickAiQuestion(candidates, askedKeys, recentKeys, off.aiLastQuestionText ?? null);
          const qKey = normalizeArabicQuestion(botQuestionText);
          const botQid = id();
          const botQuestion = { id: botQid, text: botQuestionText, askedBy: botId, answers: { [userId]: null }, majority: null };
          store.setState((s) => ({
            gameState: s.gameState
              ? {
                  ...s.gameState,
                  currentTurn: botId,
                  questions: [botQuestion, ...(s.gameState.questions ?? [])],
                  offline: {
                    ...(s.gameState as any).offline,
                    aiAsked: [...askedKeys, qKey],
                    aiRecent: [...recentKeys.slice(-2), qKey],
                    aiLastQuestionId: botQid,
                    aiLastQuestionText: botQuestionText,
                    lastGuess: null,
                    lastGuessCorrect: null
                  }
                }
              : s.gameState,
            messages: [{ id: id(), ts: nowMs(), type: 'aiQuestion', text: `AI asks: ${botQuestionText}`, payload: botQuestion }, ...s.messages].slice(0, 100)
          }));
        }, 500);
      }, 650);
      return;
    }
    await emitAck('sendQuestion', { text });
  },

  async sendAnswer(questionId: string, answer: 'YES' | 'NO' | 'MAYBE' | 'SKIP') {
    if (isOfflineRoom(store.getState().currentRoom)) {
      const userId = store.getState().userId ?? '';
      const botId = 'bot_ai_1';
      const botName = 'AI Bot';
      const st = store.getState();
      const g = st.gameState;
      if (!g || !userId) return;
      const latestQ = g.questions?.[0] ?? null;
      if (!latestQ || String(latestQ.id) !== String(questionId) || String(latestQ.askedBy) !== String(botId)) return;
      store.setState((s) => {
        if (!s.gameState) return s;
        const qs = Array.isArray(s.gameState.questions) ? s.gameState.questions : [];
        const updated = qs.map((q: any) => {
          if (String(q.id) !== String(questionId)) return q;
          return { ...q, answers: { ...(q.answers ?? {}), [userId]: answer } };
        });
        const off = (s.gameState as any).offline ?? {};
        const prevCandidates = Array.isArray(off.aiCandidates) ? off.aiCandidates : offlineCards;
        const nextCandidates =
          answer === 'YES' || answer === 'NO'
            ? offlineApplyAnswerToCandidates(prevCandidates, String(latestQ.text ?? ''), answer)
            : prevCandidates;
        return {
          ...s,
          gameState: { ...s.gameState, questions: updated, offline: { ...off, aiCandidates: nextCandidates } },
          messages: [{ id: id(), ts: nowMs(), type: 'answer', text: `You answered AI: ${answer}`, payload: { questionId, answer } }, ...s.messages].slice(0, 100)
        };
      });

      const after = store.getState();
      const off2 = (after.gameState as any)?.offline ?? {};
      const candidates2 = Array.isArray(off2.aiCandidates) ? off2.aiCandidates : [];
      const botCard = off2.botCard ?? null;
      const askedCount = Array.isArray(off2.aiAsked) ? off2.aiAsked.length : 0;
      const shouldGuess = candidates2.length <= 3 || askedCount >= 6;
      if (shouldGuess && botCard && candidates2.length) {
        const targetNorm = normalizeArabicGuess(String(botCard.name ?? ''));
        const correctIdx = candidates2.findIndex((c: any) => normalizeArabicGuess(String(c?.name ?? '')) === targetNorm);
        const closeEnough = correctIdx >= 0 && candidates2.length <= 3;
        const autoWin = closeEnough && (candidates2.length <= 2 || Math.random() < 0.6);

        if (autoWin) {
          const scoreDelta = 100;
          store.setState((s) => ({
            gameState: s.gameState
              ? {
                  ...s.gameState,
                  flow: 'ended',
                  winnerId: botId,
                  scoreboard: [
                    { playerId: botId, name: botName, score: scoreDelta },
                    { playerId: userId, name: s.profile.name, score: 0 }
                  ],
                  offline: { ...(s.gameState as any).offline, lastGuess: String(botCard.name ?? ''), lastGuessCorrect: true }
                }
              : s.gameState,
            roundResult: {
              kind: 'guess',
              winnerId: botId,
              winnerName: botName,
              identity: String(botCard.name ?? ''),
              pointsDelta: scoreDelta,
              imageUri: botCard.imageUri ?? null
            },
            messages: [{ id: id(), ts: nowMs(), type: 'guess', text: 'AI guessed (close)', payload: { candidates: candidates2.length } }, ...s.messages].slice(0, 100)
          }));
          void audioService.playSFX('lose').catch(() => null);
          return;
        }

        const guessName = String(candidates2[0]?.name ?? '').trim();
        const ok = normalizeArabicGuess(guessName) && normalizeArabicGuess(guessName) === targetNorm;
        if (ok) {
          const scoreDelta = 100;
          store.setState((s) => ({
            gameState: s.gameState
              ? {
                  ...s.gameState,
                  flow: 'ended',
                  winnerId: botId,
                  scoreboard: [
                    { playerId: botId, name: botName, score: scoreDelta },
                    { playerId: userId, name: s.profile.name, score: 0 }
                  ],
                  offline: { ...(s.gameState as any).offline, lastGuess: guessName, lastGuessCorrect: true }
                }
              : s.gameState,
            roundResult: {
              kind: 'guess',
              winnerId: botId,
              winnerName: botName,
              identity: String(botCard.name ?? ''),
              pointsDelta: scoreDelta,
              imageUri: botCard.imageUri ?? null
            },
            messages: [{ id: id(), ts: nowMs(), type: 'guess', text: 'AI guessed correctly', payload: { guess: guessName } }, ...s.messages].slice(0, 100)
          }));
          void audioService.playSFX('lose').catch(() => null);
          return;
        }
        store.setState((s) => {
          const off = (s.gameState as any)?.offline ?? {};
          const rest = Array.isArray(off.aiCandidates)
            ? off.aiCandidates.filter((c: any) => normalizeArabicGuess(String(c?.name ?? '')) !== normalizeArabicGuess(guessName))
            : off.aiCandidates;
          return {
            ...s,
            gameState: s.gameState ? { ...s.gameState, offline: { ...off, aiCandidates: rest, lastGuess: guessName, lastGuessCorrect: false } } : s.gameState,
            messages: [{ id: id(), ts: nowMs(), type: 'guess', text: 'AI guessed wrong', payload: { guess: guessName } }, ...s.messages].slice(0, 100)
          };
        });
        void audioService.playSFX('wrong_guess').catch(() => null);
      }

      store.setState((s) => ({
        gameState: s.gameState ? { ...s.gameState, currentTurn: userId } : s.gameState
      }));
      return;
    }
    if (answer !== 'YES' && answer !== 'NO') return;
    await emitAck('sendAnswer', { questionId, answer });
  },

  async makeGuess(guess: string) {
    if (isOfflineRoom(store.getState().currentRoom)) {
      const g = normalizeArabicGuess(String(guess ?? '').trim());
      const target = String(store.getState().myCard?.name ?? '').trim();
      const ok = g && normalizeArabicGuess(target) === g;
      const userId = store.getState().userId ?? '';
      const botId = 'bot_ai_1';
      if (ok) {
        const scoreDelta = 100;
        store.setState((s) => ({
          recentGuesses: [g, ...s.recentGuesses.filter((x) => x.toLowerCase() !== g.toLowerCase())].slice(0, 8),
          gameState: s.gameState
            ? {
                ...s.gameState,
                flow: 'ended',
                winnerId: userId,
                scoreboard: [
                  { playerId: userId, name: s.profile.name, score: scoreDelta },
                  { playerId: botId, name: 'AI Bot', score: 0 }
                ],
                offline: { ...(s.gameState as any).offline, lastGuess: g, lastGuessCorrect: true }
              }
            : s.gameState,
          roundResult: {
            kind: 'guess',
            winnerId: userId,
            winnerName: s.profile.name,
            identity: target,
            pointsDelta: scoreDelta,
            imageUri: (store.getState().myCard as any)?.imageUri ?? null
          },
          messages: [{ id: id(), ts: nowMs(), type: 'guess', text: 'Correct guess', payload: { guess: g } }, ...s.messages].slice(0, 100)
        }));
        void audioService.playSFX('correct_guess').catch(() => null);
        void audioService.playSFX('win').catch(() => null);
        void voiceService.playVoice('correct');
      } else {
        store.setState((s) => ({
          recentGuesses: [g, ...s.recentGuesses.filter((x) => x.toLowerCase() !== g.toLowerCase())].slice(0, 8),
          gameState: s.gameState
            ? {
                ...s.gameState,
                offline: { ...(s.gameState as any).offline, lastGuess: g, lastGuessCorrect: false }
              }
            : s.gameState,
          messages: [{ id: id(), ts: nowMs(), type: 'guess', text: 'Wrong guess', payload: { guess: g } }, ...s.messages].slice(0, 100)
        }));
        void audioService.playSFX('wrong_guess').catch(() => null);
        void voiceService.playVoice('wrong');

        setTimeout(() => {
          const st = store.getState();
          const g2 = st.gameState;
          if (!g2 || !isOfflineRoom(st.currentRoom) || g2.flow !== 'playing') return;
          const off = (g2 as any).offline ?? {};
          const botId2 = 'bot_ai_1';
          const userId2 = st.userId ?? '';
          if (!userId2) return;
          const candidates = Array.isArray(off.aiCandidates) ? off.aiCandidates : offlineCards;
          const askedKeys = Array.isArray(off.aiAsked) ? off.aiAsked : [];
          const recentKeys = Array.isArray(off.aiRecent) ? off.aiRecent : [];
          const botQuestionText = offlinePickAiQuestion(candidates, askedKeys, recentKeys, off.aiLastQuestionText ?? null);
          const qKey = normalizeArabicQuestion(botQuestionText);
          const botQid = id();
          const botQuestion = { id: botQid, text: botQuestionText, askedBy: botId2, answers: { [userId2]: null }, majority: null };
          store.setState((s) => ({
            gameState: s.gameState
              ? {
                  ...s.gameState,
                  currentTurn: botId2,
                  questions: [botQuestion, ...(s.gameState.questions ?? [])],
                  offline: {
                    ...(s.gameState as any).offline,
                    aiAsked: [...askedKeys, qKey],
                    aiRecent: [...recentKeys.slice(-2), qKey],
                    aiLastQuestionId: botQid,
                    aiLastQuestionText: botQuestionText
                  }
                }
              : s.gameState,
            messages: [{ id: id(), ts: nowMs(), type: 'aiQuestion', text: `AI asks: ${botQuestionText}`, payload: botQuestion }, ...s.messages].slice(0, 100)
          }));
        }, 450);
      }
      return { correct: ok };
    }

    const res = await emitAck<{ correct?: boolean }>('makeGuess', { guess });
    store.setState((s) => ({
      recentGuesses: [guess, ...s.recentGuesses.filter((g) => g.toLowerCase() !== guess.toLowerCase())].slice(0, 8)
    }));
    return { correct: Boolean(res?.correct) };
  },

  clearRoundResult() {
    store.setState({ roundResult: null });
  },

  async setProfileName(name: string) {
    const trimmed = name.trim().slice(0, 16) || 'Guest';
    store.setState((s) => ({ profile: { ...s.profile, name: trimmed } }));
    await saveProfile({ name: trimmed });
    const userId = store.getState().userId;
    if (userId) void serverPatchProfile(store.getState().serverUrl, userId, { name: trimmed }).catch(() => null);
  },

  async setProfileAvatar(avatarId: string) {
    const avatar = resolveAvatar(avatarId);
    store.setState((s) => ({ profile: { ...s.profile, avatarId: avatar.id } }));
    await saveProfile({ avatar });
    const userId = store.getState().userId;
    if (userId) void serverPatchProfile(store.getState().serverUrl, userId, { avatarId: avatar.id }).catch(() => null);
  },

  async addCoins(delta: number) {
    const d = Math.floor(Number(delta) || 0);
    const next = Math.max(0, store.getState().profile.coins + d);
    store.setState((s) => ({ profile: { ...s.profile, coins: next } }));
    await saveCoins(next);
  },

  async unlockCategory(category: string, cost: number) {
    const cat = String(category);
    const current = store.getState().unlockedCategories;
    if (current.includes(cat)) return;
    const coins = store.getState().profile.coins;
    const c = Math.max(0, Math.floor(cost));
    if (coins < c) throw new Error('NOT_ENOUGH_COINS');
    const nextCoins = coins - c;
    const nextUnlocked = Array.from(new Set([...current, cat]));
    store.setState((s) => ({
      profile: { ...s.profile, coins: nextCoins },
      unlockedCategories: nextUnlocked
    }));
    await Promise.all([saveCoins(nextCoins), saveUnlockedCategories(nextUnlocked)]);
  },

  async reportPlayer(args: { reportedUserId: string; reason: string }) {
    const serverUrl = store.getState().serverUrl.replace(/\/+$/, '');
    const roomCode = String(store.getState().currentRoom?.roomCode ?? '').trim().toUpperCase();
    const reporterId = String(store.getState().userId ?? '').trim();
    const reportedUserId = String(args.reportedUserId ?? '').trim();
    const reason = String(args.reason ?? '').trim();
    if (!roomCode || !reporterId) throw new Error('NOT_IN_ROOM');
    if (!reportedUserId || !reason) throw new Error('INVALID_REPORT');

    const res = await fetch(`${serverUrl}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, reporterId, reportedUserId, reason })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(String(json?.error ?? 'REPORT_FAILED'));

    store.setState((s) => ({
      messages: [
        { id: id(), ts: nowMs(), type: 'report', text: `Reported ${reportedUserId}`, payload: { reportedUserId, reason } },
        ...s.messages
      ].slice(0, 100)
    }));
  },

  setReportTargetUserId(userId: string | null) {
    store.setState({ reportTargetUserId: userId ? String(userId) : null });
  },

  async blockUser(userId: string) {
    const id = String(userId ?? '').trim();
    if (!id) return;
    const next = Array.from(new Set([...store.getState().blockedUserIds, id]));
    store.setState({ blockedUserIds: next, players: store.getState().players.filter((p) => String(p?.id ?? '') !== id) });
    await saveBlockedUsers(next);
    const me = store.getState().userId;
    if (me) void serverPatchProfile(store.getState().serverUrl, me, { blockedUserIds: next }).catch(() => null);
  },

  async unblockUser(userId: string) {
    const id = String(userId ?? '').trim();
    if (!id) return;
    const next = store.getState().blockedUserIds.filter((x) => x !== id);
    store.setState({ blockedUserIds: next });
    await saveBlockedUsers(next);
    const me = store.getState().userId;
    if (me) void serverPatchProfile(store.getState().serverUrl, me, { blockedUserIds: next }).catch(() => null);
  },

  async setLanguage(language: 'ar' | 'en') {
    const next = { ...store.getState().ui, language };
    store.setState({ ui: next });
    await saveUiSettings(next);
    const me = store.getState().userId;
    if (me) void serverPatchProfile(store.getState().serverUrl, me, { ui: next }).catch(() => null);
  },

  async setUiFlag(key: 'sound' | 'haptics' | 'reduceMotion' | 'profanityFilter', value: boolean) {
    const next = { ...store.getState().ui, [key]: Boolean(value) } as GameStoreState['ui'];
    store.setState({ ui: next });
    await saveUiSettings(next);
    const me = store.getState().userId;
    if (me) void serverPatchProfile(store.getState().serverUrl, me, { ui: next }).catch(() => null);
  },

  async setAccent(accent: GameStoreState['ui']['accent']) {
    const next = { ...store.getState().ui, accent } as GameStoreState['ui'];
    store.setState({ ui: next });
    await saveUiSettings(next);
    const me = store.getState().userId;
    if (me) void serverPatchProfile(store.getState().serverUrl, me, { ui: next }).catch(() => null);
  },

  async joinVoiceRoom(roomId?: string) {
    const res = await emitAck<{ voice?: any }>('joinVoiceRoom', { roomId });
    const code = String(roomId ?? store.getState().currentRoom?.roomCode ?? '').toUpperCase();
    if (res.voice?.state) {
      store.setState({ voiceState: { roomId: code, participants: res.voice.state.participants ?? [] } });
    }
    return res.voice;
  },

  async leaveVoiceRoom() {
    await emitAck('leaveVoiceRoom');
    store.setState({ voiceState: { roomId: null, participants: [] } });
  },

  async toggleMic() {
    await emitAck('toggleMic');
  },

  async muteUser(userId: string, muted?: boolean) {
    await emitAck('muteUser', { userId, muted });
  }
};
