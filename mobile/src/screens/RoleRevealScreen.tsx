import React, { useCallback, useMemo } from 'react';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function RoleRevealScreen({ onContinue }: { onContinue: () => void }) {
  const myCard = useGameStore((s) => s.myCard);
  const serverUrl = useGameStore((s) => s.serverUrl);
  const room = useGameStore((s) => s.currentRoom);
  const offline = String(room?.roomCode ?? '') === 'OFFLINE';

  const imageUri = useMemo(() => {
    if (offline) return null;
    const direct = typeof (myCard as any)?.imageUri === 'string' ? String((myCard as any).imageUri) : '';
    if (direct) return direct;
    const base = String(serverUrl ?? '').replace(/\/+$/, '');
    const p = typeof (myCard as any)?.imagePath === 'string' ? String((myCard as any).imagePath).trim() : '';
    if (!base || !p) return null;
    return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
  }, [myCard, offline, serverUrl]);

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(function () {
    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        if (typeof p.name === 'string') {
          var h = document.querySelector('main h3');
          if (h) h.innerHTML = String(p.name).split(' ').join('<br/>');
        }
        if (typeof p.imageUri === 'string') {
          var img = document.querySelector('main img[alt="Role Avatar"]');
          if (img) img.setAttribute('src', p.imageUri);
        }
        if (p.imageUri === null) {
          var img2 = document.querySelector('main img[alt="Role Avatar"]');
          if (img2) img2.setAttribute('src', 'https://api.dicebear.com/9.x/thumbs/png?seed=hidden');
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
      if (e.text.includes('أنا جاهز')) onContinue();
    },
    [onContinue]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.role_reveal_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ name: offline ? 'مخفي' : myCard?.name ?? '—', imageUri }}
    />
  );
}
