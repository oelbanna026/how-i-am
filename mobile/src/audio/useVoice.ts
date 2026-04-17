import { useSyncExternalStore } from 'react';
import { voiceService } from './voiceService';

export function useVoice() {
  const state = useSyncExternalStore(voiceService.subscribe.bind(voiceService), () => voiceService.getState());
  return {
    ...state,
    playVoice: (eventName: Parameters<typeof voiceService.playVoice>[0]) => voiceService.playVoice(eventName),
    setVoiceEnabled: (value: boolean) => voiceService.setEnabled(value),
    setVoiceAllowOnline: (value: boolean) => voiceService.setAllowOnline(value)
  };
}
