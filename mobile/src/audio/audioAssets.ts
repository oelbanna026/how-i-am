import * as FileSystem from 'expo-file-system/legacy';

export type MusicTrackName = 'home' | 'lobby' | 'game' | 'result';
export type SfxName =
  | 'click'
  | 'join_room'
  | 'player_ready'
  | 'game_start'
  | 'timer_tick'
  | 'timer_warning'
  | 'correct_guess'
  | 'wrong_guess'
  | 'hint_used'
  | 'win'
  | 'lose';

export type AudioKey = `music:${MusicTrackName}` | `sfx:${SfxName}`;

const AUDIO_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}audio_v1`;

type Tone = { freq: number; gain: number };

const MUSIC_DEFS: Record<MusicTrackName, { durationSec: number; tones: Tone[] }> = {
  home: { durationSec: 3.2, tones: [{ freq: 220, gain: 0.22 }, { freq: 330, gain: 0.12 }, { freq: 440, gain: 0.06 }] },
  lobby: { durationSec: 3.0, tones: [{ freq: 262, gain: 0.2 }, { freq: 392, gain: 0.08 }, { freq: 523, gain: 0.05 }] },
  game: { durationSec: 2.4, tones: [{ freq: 196, gain: 0.25 }, { freq: 294, gain: 0.12 }, { freq: 587, gain: 0.03 }] },
  result: { durationSec: 2.8, tones: [{ freq: 247, gain: 0.18 }, { freq: 370, gain: 0.11 }, { freq: 740, gain: 0.03 }] }
};

const SFX_DEFS: Record<SfxName, { durationSec: number; tones: Tone[] }> = {
  click: { durationSec: 0.06, tones: [{ freq: 880, gain: 0.3 }] },
  join_room: { durationSec: 0.18, tones: [{ freq: 523, gain: 0.22 }, { freq: 659, gain: 0.14 }] },
  player_ready: { durationSec: 0.14, tones: [{ freq: 784, gain: 0.22 }] },
  game_start: { durationSec: 0.22, tones: [{ freq: 392, gain: 0.2 }, { freq: 587, gain: 0.12 }] },
  timer_tick: { durationSec: 0.05, tones: [{ freq: 1000, gain: 0.18 }] },
  timer_warning: { durationSec: 0.08, tones: [{ freq: 1200, gain: 0.25 }] },
  correct_guess: { durationSec: 0.2, tones: [{ freq: 659, gain: 0.2 }, { freq: 880, gain: 0.12 }] },
  wrong_guess: { durationSec: 0.22, tones: [{ freq: 196, gain: 0.28 }] },
  hint_used: { durationSec: 0.16, tones: [{ freq: 440, gain: 0.2 }, { freq: 660, gain: 0.08 }] },
  win: { durationSec: 0.4, tones: [{ freq: 523, gain: 0.22 }, { freq: 659, gain: 0.16 }, { freq: 784, gain: 0.1 }] },
  lose: { durationSec: 0.5, tones: [{ freq: 220, gain: 0.22 }, { freq: 196, gain: 0.18 }] }
};

function bytesToBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const a = bytes[i++] ?? 0;
    const b = i < bytes.length ? (bytes[i++] ?? 0) : NaN;
    const c = i < bytes.length ? (bytes[i++] ?? 0) : NaN;
    const triple = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += Number.isNaN(b) ? '=' : chars[(triple >> 6) & 63];
    out += Number.isNaN(c) ? '=' : chars[triple & 63];
  }
  return out;
}

function writeU16LE(buf: Uint8Array, offset: number, v: number) {
  buf[offset] = v & 255;
  buf[offset + 1] = (v >> 8) & 255;
}

function writeU32LE(buf: Uint8Array, offset: number, v: number) {
  buf[offset] = v & 255;
  buf[offset + 1] = (v >> 8) & 255;
  buf[offset + 2] = (v >> 16) & 255;
  buf[offset + 3] = (v >> 24) & 255;
}

function writeAscii(buf: Uint8Array, offset: number, s: string) {
  for (let i = 0; i < s.length; i += 1) buf[offset + i] = s.charCodeAt(i) & 255;
}

function buildSineWavBytes({
  sampleRate = 22050,
  durationSec,
  tones
}: {
  sampleRate?: number;
  durationSec: number;
  tones: Tone[];
}) {
  const nSamples = Math.max(1, Math.floor(sampleRate * Math.max(0.03, durationSec)));
  const pcmBytes = nSamples * 2;
  const headerBytes = 44;
  const buf = new Uint8Array(headerBytes + pcmBytes);

  writeAscii(buf, 0, 'RIFF');
  writeU32LE(buf, 4, 36 + pcmBytes);
  writeAscii(buf, 8, 'WAVE');
  writeAscii(buf, 12, 'fmt ');
  writeU32LE(buf, 16, 16);
  writeU16LE(buf, 20, 1);
  writeU16LE(buf, 22, 1);
  writeU32LE(buf, 24, sampleRate);
  writeU32LE(buf, 28, sampleRate * 2);
  writeU16LE(buf, 32, 2);
  writeU16LE(buf, 34, 16);
  writeAscii(buf, 36, 'data');
  writeU32LE(buf, 40, pcmBytes);

  const fadeSamples = Math.min(Math.floor(sampleRate * 0.01), Math.floor(nSamples / 6));
  for (let i = 0; i < nSamples; i += 1) {
    const t = i / sampleRate;
    let sample = 0;
    for (const tone of tones) {
      sample += Math.sin(2 * Math.PI * tone.freq * t) * tone.gain;
    }
    let fade = 1;
    if (i < fadeSamples) fade = i / fadeSamples;
    if (i > nSamples - fadeSamples) fade = Math.max(0, (nSamples - i) / fadeSamples);
    sample *= fade;
    const s16 = Math.max(-1, Math.min(1, sample));
    const v = Math.floor(s16 * 32767);
    const o = 44 + i * 2;
    writeU16LE(buf, o, v < 0 ? v + 65536 : v);
  }

  return buf;
}

function fileNameForKey(key: AudioKey) {
  return `${key.replace(/[:]/g, '_')}.wav`;
}

export async function ensureAudioUri(key: AudioKey) {
  const dir = AUDIO_DIR;
  if (!dir) throw new Error('MISSING_AUDIO_DIR');
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => null);

  const fileUri = `${dir}/${fileNameForKey(key)}`;
  const info = await FileSystem.getInfoAsync(fileUri).catch(() => null);
  if (info?.exists) return fileUri;

  const [type, name] = key.split(':') as ['music' | 'sfx', string];
  const def = type === 'music' ? MUSIC_DEFS[name as MusicTrackName] : SFX_DEFS[name as SfxName];
  if (!def) throw new Error(`UNKNOWN_AUDIO_KEY:${key}`);

  const bytes = buildSineWavBytes({ durationSec: def.durationSec, tones: def.tones });
  const base64 = bytesToBase64(bytes);
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return fileUri;
}

export function listPreloadKeys(): AudioKey[] {
  const music = (Object.keys(MUSIC_DEFS) as MusicTrackName[]).map((k) => `music:${k}` as const);
  const sfx = (Object.keys(SFX_DEFS) as SfxName[]).map((k) => `sfx:${k}` as const);
  return [...music, ...sfx];
}

