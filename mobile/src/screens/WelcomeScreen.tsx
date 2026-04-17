import React, { useCallback } from 'react';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { stitchUiHtml } from '../stitchUiAssets';

export function WelcomeScreen({ onPlay, onLogin }: { onPlay: () => void; onLogin?: () => void }) {
  const onEvent = useCallback(
    (e: StitchWebEvent) => {
      if (e.type !== 'click') return;
      const txt = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      if (txt.includes('كمل كضيف')) onPlay();
      if (txt.includes('تسجيل دخول')) onLogin?.();
    },
    [onLogin, onPlay]
  );

  return <StitchHtmlScreen htmlModule={stitchUiHtml.welcome_screen} onEvent={onEvent} />;
}
