import React, { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function CategoryPacksScreen({ onBack }: { onBack: () => void }) {
  const coins = useGameStore((s) => s.profile.coins);
  const unlocked = useGameStore((s) => s.unlockedCategories);

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function norm(s) {
    return String(s || '').replace(/\\s+/g, ' ').trim();
  }
  function keyFromLabel(t) {
    var txt = norm(t);
    if (txt.indexOf('فواكه') >= 0) return 'fruit';
    if (txt.indexOf('خضار') >= 0) return 'vegetable';
    if (txt.indexOf('أكلات') >= 0 || txt.indexOf('اكلات') >= 0) return 'food';
    if (txt.indexOf('حيوانات') >= 0) return 'animal';
    if (txt.indexOf('جماد') >= 0) return 'object';
    if (txt.indexOf('All') >= 0) return 'All';
    return null;
  }
  onReady(function () {
    try {
      var backIcon = Array.prototype.slice.call(document.querySelectorAll('span.material-symbols-outlined') || []).find(function (s) {
        return (s.textContent || '').trim() === 'group';
      });
      var backBtn = backIcon && backIcon.closest ? backIcon.closest('button') : null;
      if (backBtn) backBtn.setAttribute('data-stitch-action', 'back');
    } catch (e) {}

    try {
      var cards = Array.prototype.slice.call(document.querySelectorAll('div.glass-card.cursor-pointer') || []);
      cards.forEach(function (c) {
        c.setAttribute('data-stitch-tap', '1');
        var label = c.querySelector('span.font-bold');
        var txt = norm(label ? label.textContent : '');
        var key = keyFromLabel(txt);
        if (!key) {
          c.style.display = 'none';
          return;
        }
        c.setAttribute('data-cat-key', key);
        c.setAttribute('data-stitch-action', 'catKey:' + key);
      });
    } catch (e) {}

    try {
      var btn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
        return norm(b.textContent) === 'كمل';
      });
      if (btn) btn.setAttribute('data-stitch-action', 'continue');
    } catch (e) {}

    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var unlocked = Array.isArray(p.unlocked) ? p.unlocked.map(String) : [];
        var cards = Array.prototype.slice.call(document.querySelectorAll('div.glass-card.cursor-pointer') || []);
        cards.forEach(function (c) {
          var key = c.getAttribute ? c.getAttribute('data-cat-key') : null;
          if (!key) return;
          var isOn = unlocked.indexOf(key) >= 0 || key === 'All';
          var badge = c.querySelector('span.material-symbols-outlined[data-icon="check"]');
          if (badge) badge.parentElement.parentElement.style.opacity = isOn ? '1' : '0';
          c.style.borderColor = isOn ? 'rgba(255,176,32,0.6)' : '';
        });
      } catch (e) {}
    };
  });
})();
true;
`;
  }, []);

  const onEvent = useCallback(
    async (e: StitchWebEvent) => {
      if (e.type !== 'click') return;
      const action = String(e.action ?? '').trim();
      const txt = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      const icon = e.dataIcon ?? null;

      if (icon === 'home' || txt === 'home') onBack();

      if (action === 'back' || icon === 'group' || txt === 'group') onBack();
      if (action === 'continue' || txt === 'كمل') onBack();

      if (action.startsWith('catKey:')) {
        const key = action.slice('catKey:'.length).trim();
        const cost = 50;
        if (!key) return;
        if (unlocked.includes(key) || key === 'All') return;
        try {
          await gameActions.unlockCategory(key, cost);
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
      }
    },
    [coins, onBack, unlocked]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.category_packs_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ coins, unlocked }}
    />
  );
}
