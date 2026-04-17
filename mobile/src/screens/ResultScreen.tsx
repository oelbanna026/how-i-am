import React, { useCallback } from 'react';
import { gameActions } from '../gameStore';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { stitchUiHtml } from '../stitchUiAssets';

export function ResultScreen({ onBackToHome }: { onBackToHome: () => void }) {
  const onEvent = useCallback(
    async (e: StitchWebEvent) => {
      if (e.type !== 'click') return;
      if (e.text === 'home' || e.dataIcon === 'home' || e.text === 'play_arrow' || e.dataIcon === 'play_arrow') {
        await gameActions.leaveRoom();
        onBackToHome();
      }
    },
    [onBackToHome]
  );

  return <StitchHtmlScreen htmlModule={stitchUiHtml.end_game_screen} onEvent={onEvent} />;
}
