import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

export type VoiceEventName = 'your_turn' | 'correct' | 'wrong' | 'time_up';

type VoiceState = {
  enabled: boolean;
  allowOnline: boolean;
  isOnline: boolean;
  lastSpokenAt: number;
};

type Listener = () => void;

const ENABLED_KEY = 'VOICE_ENABLED_V1';
const ALLOW_ONLINE_KEY = 'VOICE_ALLOW_ONLINE_V1';
const DEFAULT_ENABLED = true;
const DEFAULT_ALLOW_ONLINE = false;
const COOLDOWN_MS = 2500;

function nowMs() {
  return Date.now();
}

class VoiceService {
  private state: VoiceState = { enabled: DEFAULT_ENABLED, allowOnline: DEFAULT_ALLOW_ONLINE, isOnline: false, lastSpokenAt: 0 };
  private listeners = new Set<Listener>();
  private initPromise: Promise<void> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  private setState(patch: Partial<VoiceState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const [en, ao] = await Promise.all([
        AsyncStorage.getItem(ENABLED_KEY).catch(() => null),
        AsyncStorage.getItem(ALLOW_ONLINE_KEY).catch(() => null)
      ]);
      const enabled = en != null ? String(en) !== '0' : DEFAULT_ENABLED;
      const allowOnline = ao != null ? String(ao) === '1' : DEFAULT_ALLOW_ONLINE;
      this.setState({ enabled, allowOnline });
    })();
    return this.initPromise;
  }

  async setEnabled(enabled: boolean) {
    const en = Boolean(enabled);
    this.setState({ enabled: en });
    await AsyncStorage.setItem(ENABLED_KEY, en ? '1' : '0').catch(() => null);
    if (!en) {
      try {
        Speech.stop();
      } catch {}
    }
  }

  async setAllowOnline(allow: boolean) {
    const v = Boolean(allow);
    this.setState({ allowOnline: v });
    await AsyncStorage.setItem(ALLOW_ONLINE_KEY, v ? '1' : '0').catch(() => null);
  }

  setContext(ctx: { isOnline: boolean }) {
    const isOnline = Boolean(ctx?.isOnline);
    if (isOnline === this.state.isOnline) return;
    this.setState({ isOnline });
    if (isOnline && !this.state.allowOnline) {
      try {
        Speech.stop();
      } catch {}
    }
  }

  private phraseFor(event: VoiceEventName) {
    if (event === 'your_turn') return 'دورك';
    if (event === 'correct') return 'إجابة صحيحة';
    if (event === 'wrong') return 'خطأ';
    return 'انتهى الوقت';
  }

  playVoice(event: VoiceEventName) {
    void this.init();
    if (!this.state.enabled) return;
    if (this.state.isOnline && !this.state.allowOnline) return;
    const t = nowMs();
    if (t - this.state.lastSpokenAt < COOLDOWN_MS) return;
    this.setState({ lastSpokenAt: t });
    const text = this.phraseFor(event);
    try {
      Speech.stop();
    } catch {}
    try {
      Speech.speak(text, {
        language: 'ar',
        rate: 0.92,
        pitch: 1.05
      });
    } catch {}
  }
}

export const voiceService = new VoiceService();
