import React, { useCallback, useEffect, useMemo } from 'react';
import { CARD_PLACEHOLDER_DATA_URI, preloadImageUris } from '../cardImages';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function RoundResultScreen({ onClose }: { onClose: () => void }) {
  const round = useGameStore((s) => s.roundResult);

  useEffect(() => {
    if (!round) return;
    void preloadImageUris([round?.imageUri ?? null]).catch(() => null);
  }, [round]);

  if (!round) return null;

  const injected = useMemo(() => {
    const placeholderImage = JSON.stringify(CARD_PLACEHOLDER_DATA_URI);
    return `
(function () {
  var PLACEHOLDER_IMAGE = ${placeholderImage};
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function setText(el, t) {
    try { if (el) el.textContent = String(t ?? ''); } catch (e) {}
  }
  function loadImage(el, src) {
    try {
      if (!el) return;
      var nextSrc = String(src || '').trim() || PLACEHOLDER_IMAGE;
      el.setAttribute('src', PLACEHOLDER_IMAGE);
      var probe = new Image();
      probe.onload = function () {
        try { el.setAttribute('src', nextSrc); } catch (e) {}
      };
      probe.onerror = function () {
        try { el.setAttribute('src', PLACEHOLDER_IMAGE); } catch (e) {}
      };
      probe.src = nextSrc;
    } catch (e) {}
  }
  onReady(function () {
    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var h2 = document.querySelector('main h2');
        if (h2 && typeof p.winnerName === 'string') h2.textContent = p.winnerName;
        var delta = document.querySelector('main .absolute.-bottom-2.-right-2');
        if (delta && typeof p.deltaText === 'string') setText(delta, p.deltaText);
        var identity = Array.prototype.slice.call(document.querySelectorAll('main h3') || []).find(function (x) {
          return (x.className || '').indexOf('text-3xl') >= 0;
        });
        if (identity && typeof p.identityText === 'string') setText(identity, p.identityText);
        var img = document.querySelector('main img');
        loadImage(img, typeof p.imageUri === 'string' ? p.imageUri : PLACEHOLDER_IMAGE);
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
      if (e.tag === 'button') {
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
        winnerName: String(round?.winnerName ?? ''),
        identityText: String(round?.identity ?? '-'),
        deltaText: typeof round?.pointsDelta === 'number' ? `${round.pointsDelta >= 0 ? '+' : ''}${round.pointsDelta}` : '+0',
        imageUri: round?.imageUri ?? null
      }}
    />
  );
}
