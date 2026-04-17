import { useEffect, useSyncExternalStore } from 'react';
import { audioService } from './audioService';
import { useGameStore } from '../gameStore';
import { voiceService } from './voiceService';

export function useAudio() {
  const uiSoundEnabled = useGameStore((s) => s.ui?.sound);
  const voiceEnabled = useGameStore((s) => s.ui?.voice);
  const connected = useGameStore((s) => s.connected);
  const roomCode = useGameStore((s) => String(s.currentRoom?.roomCode ?? ''));
  const isOnline = Boolean(connected) && roomCode !== 'OFFLINE';

  useEffect(() => {
    if (typeof uiSoundEnabled === 'boolean') void audioService.setEnabled(uiSoundEnabled);
    if (typeof voiceEnabled === 'boolean') void voiceService.setEnabled(voiceEnabled);
  }, [uiSoundEnabled, voiceEnabled]);

  useEffect(() => {
    voiceService.setContext({ isOnline });
  }, [isOnline]);

  const state = useSyncExternalStore(audioService.subscribe.bind(audioService), () => audioService.getState());

  return {
    ...state,
    playMusic: (trackName: Parameters<typeof audioService.playMusic>[0]) => audioService.playMusic(trackName),
    stopMusic: () => audioService.stopMusic(),
    playSFX: (soundName: Parameters<typeof audioService.playSFX>[0]) => audioService.playSFX(soundName),
    playVoice: (eventName: Parameters<typeof voiceService.playVoice>[0]) => voiceService.playVoice(eventName),
    setMusicVolume: (value: number) => audioService.setMusicVolume(value),
    setSFXVolume: (value: number) => audioService.setSfxVolume(value)
  };
}
