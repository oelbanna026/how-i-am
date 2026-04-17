import React, { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function ProfileSettingsScreen({
  onBack,
  onGoReport,
  onGoHome,
  onGoCreate,
  onGoScoreboard
}: {
  onBack: () => void;
  onGoReport?: () => void;
  onGoHome?: () => void;
  onGoCreate?: () => void;
  onGoScoreboard?: () => void;
}) {
  const profile = useGameStore((s) => s.profile);
  const blocked = useGameStore((s) => s.blockedUserIds);
  const ui = useGameStore((s) => s.ui);

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function post(msg) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    } catch (e) {}
  }
  onReady(function () {
    try {
      var nav = document.querySelector('nav.fixed.bottom-0');
      if (nav) {
        nav.style.pointerEvents = 'auto';
        nav.style.zIndex = '99999';
      }
      var links = nav ? Array.prototype.slice.call(nav.querySelectorAll('a') || []) : [];
      links.forEach(function (a) {
        try {
          var icon = a.querySelector('[data-icon]') ? a.querySelector('[data-icon]').getAttribute('data-icon') : null;
          if (icon) a.setAttribute('data-stitch-action', 'nav:' + icon);
          a.setAttribute('role', 'button');
          a.setAttribute('data-stitch-tap', '1');
        } catch (e) {}
      });
    } catch (e) {}

    try {
      var nameEl = document.querySelector('main h2');
      if (nameEl) {
        nameEl.id = 'profile_name';
        nameEl.setAttribute('contenteditable', 'true');
        nameEl.setAttribute('spellcheck', 'false');
        nameEl.style.outline = 'none';
        nameEl.style.webkitUserSelect = 'text';
        nameEl.addEventListener('blur', function () {
          post({ type: 'input', value: String((nameEl.innerText || nameEl.textContent || '').trim()), id: 'profile_name', name: null, placeholder: null, contentEditable: true, source: 'blur' });
        });
      }
    } catch (e) {}

    try {
      var avatarRow = document.querySelector('main .flex.gap-3.mt-8');
      if (avatarRow) {
        var btns = Array.prototype.slice.call(avatarRow.querySelectorAll('button') || []);
        var accents = ['primary','tertiary','secondary','error','custom'];
        btns.forEach(function (b, idx) {
          if (!b) return;
          var a = accents[idx] || 'primary';
          b.setAttribute('data-stitch-action', 'accent:' + a);
        });
      }
    } catch (e) {}

    try {
      var langBtns = Array.prototype.slice.call(document.querySelectorAll('button') || []).filter(function (b) {
        var t = ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '');
        return t === 'العربية' || t === 'EN';
      });
      langBtns.forEach(function (b) {
        var t = ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '');
        b.setAttribute('data-stitch-action', t === 'EN' ? 'lang:en' : 'lang:ar');
      });
    } catch (e) {}

    try {
      var toggles = Array.prototype.slice.call(document.querySelectorAll('input[type="checkbox"].sr-only') || []);
      if (toggles[0]) toggles[0].id = 'toggle_sound';
      if (toggles[1]) toggles[1].id = 'toggle_haptics';
      if (toggles[2]) toggles[2].id = 'toggle_reduce_motion';
      if (toggles[3]) toggles[3].id = 'toggle_profanity';
    } catch (e) {}

    try {
      var reportBtn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
        return ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '').indexOf('بلاغ عن لاعب') >= 0;
      });
      if (reportBtn) reportBtn.setAttribute('data-stitch-action', 'go_report');
    } catch (e) {}

    try {
      var blockBtn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
        return ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '').indexOf('قائمة الحظر') >= 0;
      });
      if (blockBtn) blockBtn.setAttribute('data-stitch-action', 'open_blocklist');
    } catch (e) {}

    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var el = document.getElementById('profile_name');
        if (el && typeof p.profileName === 'string' && (el.textContent || '').trim() !== p.profileName) {
          el.textContent = p.profileName;
        }
        if (typeof p.language === 'string') {
          var arBtn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) { return ((b.textContent||'').trim() === 'العربية'); });
          var enBtn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) { return ((b.textContent||'').trim() === 'EN'); });
          if (arBtn && enBtn) {
            if (p.language === 'en') {
              enBtn.classList.add('bg-primary','text-on-primary');
              arBtn.classList.remove('bg-primary','text-on-primary');
            } else {
              arBtn.classList.add('bg-primary','text-on-primary');
              enBtn.classList.remove('bg-primary','text-on-primary');
            }
          }
        }
        if (p.toggles) {
          var s = document.getElementById('toggle_sound');
          var h = document.getElementById('toggle_haptics');
          var rm = document.getElementById('toggle_reduce_motion');
          var pf = document.getElementById('toggle_profanity');
          if (s) s.checked = Boolean(p.toggles.sound);
          if (h) h.checked = Boolean(p.toggles.haptics);
          if (rm) rm.checked = Boolean(p.toggles.reduceMotion);
          if (pf) pf.checked = Boolean(p.toggles.profanityFilter);
        }

        if (typeof p.accent === 'string') {
          var row = document.querySelector('main .flex.gap-3.mt-8');
          if (row) {
            var btns = Array.prototype.slice.call(row.querySelectorAll('button') || []);
            btns.forEach(function (b) {
              if (!b) return;
              b.classList.remove('ring-2','ring-white','ring-offset-4','ring-offset-background');
            });
            var map = { primary: 0, tertiary: 1, secondary: 2, error: 3, custom: 4 };
            var idx = map[p.accent] != null ? map[p.accent] : 0;
            var sel = btns[idx] || null;
            if (sel) sel.classList.add('ring-2','ring-white','ring-offset-4','ring-offset-background');
          }
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
      if (e.type === 'input') {
        if (e.id === 'toggle_sound') {
          void gameActions.setUiFlag('sound', String(e.value) === 'true').catch(() => null);
          return;
        }
        if (e.id === 'toggle_haptics') {
          void gameActions.setUiFlag('haptics', String(e.value) === 'true').catch(() => null);
          return;
        }
        if (e.id === 'toggle_reduce_motion') {
          void gameActions.setUiFlag('reduceMotion', String(e.value) === 'true').catch(() => null);
          return;
        }
        if (e.id === 'toggle_profanity') {
          void gameActions.setUiFlag('profanityFilter', String(e.value) === 'true').catch(() => null);
          return;
        }
        if (e.id !== 'profile_name' && !e.contentEditable) return;
        if (e.id === 'profile_name' && e.source !== 'blur') return;
        const next = String(e.value ?? '').trim().slice(0, 16) || 'Guest';
        void gameActions.setProfileName(next).catch(() => null);
        return;
      }
      if (e.type !== 'click') return;
      const action = String(e.action ?? '').trim();
      const txt = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      const icon = e.dataIcon ?? null;
      if (icon === 'group' || txt === 'group') onBack();
      if (action === 'nav:home') onGoHome?.();
      if (action === 'nav:sports_esports') onGoCreate?.();
      if (action === 'nav:leaderboard') onGoScoreboard?.();
      if (action === 'nav:person') return;
      if (action === 'go_report' || txt.includes('بلاغ عن لاعب')) onGoReport?.();
      if (action === 'open_blocklist' || txt.includes('قائمة الحظر')) {
        const list = blocked.map(String).filter(Boolean);
        Alert.alert('قائمة الحظر', list.length ? list.join('\n') : 'لا يوجد');
      }
      if (action.startsWith('accent:')) {
        const a = action.slice('accent:'.length).trim() as any;
        if (a === 'custom') {
          Alert.alert('ألوان', 'قريبًا');
          void gameActions.setAccent('custom').catch(() => null);
        } else if (a === 'primary' || a === 'tertiary' || a === 'secondary' || a === 'error') {
          void gameActions.setAccent(a).catch(() => null);
        }
      }
      if (action === 'lang:ar') void gameActions.setLanguage('ar').catch(() => null);
      if (action === 'lang:en') void gameActions.setLanguage('en').catch(() => null);
    },
    [blocked, onBack, onGoCreate, onGoHome, onGoReport, onGoScoreboard]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.profile_settings_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{
        profileName: profile.name,
        language: ui.language,
        accent: ui.accent,
        toggles: {
          sound: ui.sound,
          haptics: ui.haptics,
          reduceMotion: ui.reduceMotion,
          profanityFilter: ui.profanityFilter
        }
      }}
    />
  );
}
