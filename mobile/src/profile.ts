import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Avatar, Profile } from './types';

const STORAGE_KEY = 'wai_profile_v1';

function randomId() {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const avatarOptions: Avatar[] = [
  { id: 'a1', emoji: '😎', color: '#7C3AED' },
  { id: 'a2', emoji: '🤖', color: '#06B6D4' },
  { id: 'a3', emoji: '🦁', color: '#F59E0B' },
  { id: 'a4', emoji: '🐼', color: '#22C55E' },
  { id: 'a5', emoji: '🧠', color: '#A78BFA' },
  { id: 'a6', emoji: '👑', color: '#EF4444' },
  { id: 'a7', emoji: '🦅', color: '#3B82F6' },
  { id: 'a8', emoji: '🐉', color: '#10B981' },
  { id: 'a9', emoji: '🧿', color: '#0EA5E9' },
  { id: 'a10', emoji: '👽', color: '#84CC16' },
  { id: 'a11', emoji: '🎮', color: '#F97316' },
  { id: 'a12', emoji: '🧁', color: '#EC4899' }
];

export function resolveAvatar(avatarId: string | undefined | null): Avatar {
  const found = avatarOptions.find((a) => a.id === avatarId);
  return found ?? avatarOptions[0];
}

export async function loadProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Profile>;
      const deviceId = typeof parsed.deviceId === 'string' && parsed.deviceId ? parsed.deviceId : randomId();
      const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 16) : 'Guest';
      const avatar = resolveAvatar(parsed.avatar?.id ?? 'a1');
      const profile: Profile = { deviceId, name, avatar };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      return profile;
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }
  const profile: Profile = { deviceId: randomId(), name: 'Guest', avatar: avatarOptions[0] };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const current = await loadProfile();
  const merged: Profile = {
    deviceId: patch.deviceId ?? current.deviceId,
    name: patch.name ? patch.name.trim().slice(0, 16) : current.name,
    avatar: patch.avatar ?? current.avatar
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

