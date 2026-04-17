import React, { useCallback, useMemo } from 'react';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function RoundResultScreen({ onClose }: { onClose: () => void }) {
  const round = useGameStore((s) => s.roundResult);

  if (!round) return null;

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function setText(el, t) {
    try { if (el) el.textContent = String(t ?? ''); } catch (e) {}
  }
  onReady(function () {
    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var h2 = document.querySelector('main h2');
        if (h2 && typeof p.winnerName === 'string') h2.textContent = p.winnerName + ' عرف التخمين! 🎉';
        var delta = document.querySelector('main .absolute.-bottom-2.-right-2');
        if (delta && typeof p.deltaText === 'string') setText(delta, p.deltaText);
        var identity = Array.prototype.slice.call(document.querySelectorAll('main h3') || []).find(function (x) {
          return (x.className || '').indexOf('text-3xl') >= 0;
        });
        if (identity && typeof p.identityText === 'string') setText(identity, p.identityText);
        if (typeof p.imageUri === 'string') {
          var img = document.querySelector('main img');
          if (img) img.setAttribute('src', p.imageUri);
        }
      } catch (e) {}
    };
  });
})();
true;
`;
  }, []);

  const onEvent = useCallback(
    (e: StitchWebEvent) => {
      if (e.type !== 'click') return;
      if (e.text.includes('الجولة اللي بعديها')) {
        gameActions.clearRoundResult();
        onClose();
      }
    },
    [onClose]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.round_result_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{
        winnerName: String(round?.winnerName ?? 'حد'),
        identityText: round?.identity ? `كنت: ${round.identity}` : 'كنت: —',
        deltaText: typeof round?.pointsDelta === 'number' ? `${round.pointsDelta >= 0 ? '+' : ''}${round.pointsDelta} نقطة` : '+0 نقطة',
        imageUri: round?.imageUri ?? null
      }}
    />
  );
}
