import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureAudioUri, type AudioKey, type MusicTrackName, type SfxName, listPreloadKeys } from './audioAssets';

type AudioState = {
  ready: boolean;
  enabled: boolean;
  currentMusic: MusicTrackName | null;
  musicVolume: number;
  sfxVolume: number;
};

type Listener = () => void;

const MUSIC_VOL_KEY = 'AUDIO_MUSIC_VOLUME_V1';
const SFX_VOL_KEY = 'AUDIO_SFX_VOLUME_V1';
const ENABLED_KEY = 'AUDIO_ENABLED_V1';

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

let ExpoAudio: any | undefined;
let ExponentAvAvailable: boolean | undefined;

function isExponentAvAvailable() {
  if (ExponentAvAvailable !== undefined) return ExponentAvAvailable;
  try {
    const core = require('expo-modules-core');
    const opt = typeof core?.requireOptionalNativeModule === 'function' ? core.requireOptionalNativeModule : null;
    const m = opt ? opt('ExponentAV') : null;
    ExponentAvAvailable = Boolean(m);
  } catch {
    ExponentAvAvailable = false;
  }
  return ExponentAvAvailable;
}

function getExpoAudio(): any | null {
  if (!isExponentAvAvailable()) return null;
  if (ExpoAudio !== undefined) return ExpoAudio;
  try {
    ExpoAudio = require('expo-av').Audio;
  } catch {
    ExpoAudio = null;
  }
  return ExpoAudio;
}

function disableExpoAudio() {
  ExpoAudio = null;
}

class AudioService {
  private state: AudioState = { ready: false, enabled: true, currentMusic: null, musicVolume: 0.6, sfxVolume: 0.9 };
  private listeners = new Set<Listener>();

  private initPromise: Promise<void> | null = null;
  private music: any | null = null;
  private musicName: MusicTrackName | null = null;

  private sfxPools = new Map<SfxName, { sounds: any[]; idx: number }>();
  private preloadDone = false;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  private setState(patch: Partial<AudioState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const [m, s, en] = await Promise.all([
          AsyncStorage.getItem(MUSIC_VOL_KEY).catch(() => null),
          AsyncStorage.getItem(SFX_VOL_KEY).catch(() => null),
          AsyncStorage.getItem(ENABLED_KEY).catch(() => null)
        ]);
        const musicVolume = m != null ? clamp01(Number(m)) : this.state.musicVolume;
        const sfxVolume = s != null ? clamp01(Number(s)) : this.state.sfxVolume;
        const enabled = en != null ? String(en) !== '0' : this.state.enabled;
        this.setState({ musicVolume, sfxVolume, enabled });

        const Audio = getExpoAudio();
        if (Audio) {
          try {
            await Audio.setAudioModeAsync({
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
              interruptionModeIOS: (Audio as any).INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS ?? 2,
              interruptionModeAndroid: (Audio as any).INTERRUPTION_MODE_ANDROID_DUCK_OTHERS ?? 2,
              shouldDuckAndroid: true
            });
          } catch {
            disableExpoAudio();
          }
        }
      } catch {}

      this.setState({ ready: true });
      void this.preload();
    })();
    return this.initPromise;
  }

  async preload() {
    try {
      await this.init();
      if (this.preloadDone) return;
      this.preloadDone = true;

      const Audio = getExpoAudio();
      if (!Audio) return;

      const keys = listPreloadKeys();
      await Promise.all(keys.map((k) => ensureAudioUri(k).catch(() => null)));

      const sfxNames: SfxName[] = [
        'click',
        'join_room',
        'player_ready',
        'game_start',
        'timer_tick',
        'timer_warning',
        'correct_guess',
        'wrong_guess',
        'hint_used',
        'win',
        'lose'
      ];

      for (const name of sfxNames) {
        const poolSize = name === 'click' || name === 'timer_tick' || name === 'timer_warning' ? 3 : 1;
        const uris = await Promise.all(
          Array.from({ length: poolSize }).map(async () => ensureAudioUri(`sfx:${name}` as AudioKey))
        );
        const sounds: any[] = [];
        for (const uri of uris) {
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: false, volume: this.state.enabled ? this.state.sfxVolume : 0 }
            );
            sounds.push(sound);
          } catch {
            disableExpoAudio();
            return;
          }
        }
        this.sfxPools.set(name, { sounds, idx: 0 });
      }
    } catch {}
  }

  async setEnabled(enabled: boolean) {
    const en = Boolean(enabled);
    this.setState({ enabled: en });
    await AsyncStorage.setItem(ENABLED_KEY, en ? '1' : '0').catch(() => null);
    if (this.music) await this.music.setVolumeAsync(en ? this.state.musicVolume : 0).catch(() => null);
    for (const pool of this.sfxPools.values()) {
      for (const s of pool.sounds) await s.setVolumeAsync(en ? this.state.sfxVolume : 0).catch(() => null);
    }
  }

  async setMusicVolume(value: number) {
    const v = clamp01(value);
    this.setState({ musicVolume: v });
    await AsyncStorage.setItem(MUSIC_VOL_KEY, String(v)).catch(() => null);
    if (this.music) await this.music.setVolumeAsync(this.state.enabled ? v : 0).catch(() => null);
  }

  async setSfxVolume(value: number) {
    const v = clamp01(value);
    this.setState({ sfxVolume: v });
    await AsyncStorage.setItem(SFX_VOL_KEY, String(v)).catch(() => null);
    for (const pool of this.sfxPools.values()) {
      for (const s of pool.sounds) await s.setVolumeAsync(this.state.enabled ? v : 0).catch(() => null);
    }
  }

  async stopMusic() {
    try {
      await this.init();
      if (!this.music) return;
      try {
        await this.music.stopAsync();
      } catch {}
      try {
        await this.music.unloadAsync();
      } catch {}
      this.music = null;
      this.musicName = null;
      this.setState({ currentMusic: null });
    } catch {}
  }

  async playMusic(trackName: MusicTrackName) {
    try {
      await this.init();
      const Audio = getExpoAudio();
      if (!Audio) return;
      if (this.musicName === trackName) return;
      await this.stopMusic();
      const uri = await ensureAudioUri(`music:${trackName}` as AudioKey);
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, isLooping: true, volume: this.state.enabled ? this.state.musicVolume : 0 }
      );
      this.music = sound;
      this.musicName = trackName;
      this.setState({ currentMusic: trackName });
      await sound.playAsync();
    } catch {
      disableExpoAudio();
    }
  }

  async playSFX(name: SfxName) {
    try {
      await this.init();
      const Audio = getExpoAudio();
      if (!Audio) return;
      if (!this.state.enabled) return;
      const pool = this.sfxPools.get(name);
      if (pool?.sounds?.length) {
        const s = pool.sounds[pool.idx % pool.sounds.length];
        pool.idx = (pool.idx + 1) % pool.sounds.length;
        try {
          await s.setPositionAsync(0);
        } catch {}
        try {
          await s.playAsync();
        } catch {}
        return;
      }

      const uri = await ensureAudioUri(`sfx:${name}` as AudioKey);
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: this.state.sfxVolume });
      const onStatus = (status: any) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          void sound.unloadAsync().catch(() => null);
        }
      };
      sound.setOnPlaybackStatusUpdate(onStatus);
    } catch {
      disableExpoAudio();
    }
  }
}

export const audioService = new AudioService();
