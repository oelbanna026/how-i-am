import React, { useCallback, useEffect, useMemo } from 'react';
import { CARD_PLACEHOLDER_DATA_URI, preloadImageUris, resolveCardImageUri } from '../cardImages';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function RoleRevealScreen({ onContinue }: { onContinue: () => void }) {
  const myCard = useGameStore((s) => s.myCard);
  const serverUrl = useGameStore((s) => s.serverUrl);

  const imageUri = useMemo(() => resolveCardImageUri(serverUrl, myCard), [myCard, serverUrl]);

  useEffect(() => {
    void preloadImageUris([imageUri]).catch(() => null);
  }, [imageUri]);

  const injected = useMemo(() => {
    const placeholderImage = JSON.stringify(CARD_PLACEHOLDER_DATA_URI);
    return `
(function () {
  var PLACEHOLDER_IMAGE = ${placeholderImage};
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
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
        if (typeof p.name === 'string') {
          var h = document.querySelector('main h3');
          if (h) h.innerHTML = String(p.name).split(' ').join('<br/>');
        }
        var img = document.querySelector('main img[alt="Role Avatar"]');
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
      if (e.tag === 'button') onContinue();
    },
    [onContinue]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.role_reveal_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ name: myCard?.name ?? '-', imageUri }}
    />
  );
}
