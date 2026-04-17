import React, { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function CreateRoomScreen({ onCreated, onBack }: { onCreated: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const profileName = useGameStore((s) => s.profile.name);
  const coins = useGameStore((s) => s.profile.coins);
  const unlocked = useGameStore((s) => s.unlockedCategories);
  const [roomName, setRoomName] = useState('لمة الجمعة');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [rounds, setRounds] = useState(5);
  const [turnSec, setTurnSec] = useState(60);
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showPacks, setShowPacks] = useState(false);
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function byIcon(icon) {
    try {
      var spans = Array.prototype.slice.call(document.querySelectorAll('span.material-symbols-outlined') || []);
      var s = spans.find(function (x) { return (x.textContent || '').trim() === icon; });
      if (!s) return null;
      var btn = s.closest ? s.closest('button') : null;
      return btn || null;
    } catch (e) {}
    return null;
  }

  onReady(function () {
    try {
      var badge = Array.prototype.slice.call(document.querySelectorAll('span') || []).find(function (s) {
        return ((s.textContent || '').replace(/\\s+/g, ' ').trim() || '').indexOf('إعدادات اللعبة') >= 0;
      });
      if (badge) {
        badge.setAttribute('data-stitch-tap', '1');
        badge.setAttribute('data-stitch-action', 'open_packs');
        badge.setAttribute('role', 'button');
        badge.style.cursor = 'pointer';
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.padding = '10px 14px';
        badge.style.borderRadius = '999px';
        badge.style.fontSize = '13px';
        badge.style.letterSpacing = '2px';
        badge.style.boxShadow = '0 0 0 2px rgba(255,176,32,0.25), 0 10px 30px rgba(0,0,0,0.35)';
      }
    } catch (e) {}

    try {
      var input = document.querySelector('input[type="text"]');
      if (input) input.id = 'room_name';
    } catch (e) {}

    try {
      var dec = byIcon('remove');
      var inc = byIcon('add');
      if (dec) dec.setAttribute('data-stitch-action', 'players_dec');
      if (inc) inc.setAttribute('data-stitch-action', 'players_inc');
    } catch (e) {}

    try {
      var up = byIcon('keyboard_arrow_up');
      var down = byIcon('keyboard_arrow_down');
      if (up) up.setAttribute('data-stitch-action', 'rounds_up');
      if (down) down.setAttribute('data-stitch-action', 'rounds_down');
    } catch (e) {}

    try {
      var timeBtns = Array.prototype.slice.call(document.querySelectorAll('section button') || []).filter(function (b) {
        var t = (b.textContent || '').trim();
        return t === '30' || t === '60' || t === '90';
      });
      timeBtns.forEach(function (b) {
        var t = (b.textContent || '').trim();
        b.setAttribute('data-stitch-action', 'time_' + t);
      });
    } catch (e) {}

    try {
      var toggles = Array.prototype.slice.call(document.querySelectorAll('div.w-14.h-8.bg-primary.rounded-full') || []);
      var toggle = toggles[0] || null;
      if (toggle) toggle.setAttribute('data-stitch-action', 'privacy_toggle');
    } catch (e) {}

    try {
      var rocket = byIcon('rocket_launch');
      if (rocket) rocket.setAttribute('data-stitch-action', 'create_room');
      var back = byIcon('arrow_forward');
      if (back) back.setAttribute('data-stitch-action', 'back');
    } catch (e) {}

    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var input = document.getElementById('room_name');
        if (input && typeof p.roomName === 'string' && input.value !== p.roomName) input.value = p.roomName;

        var playersVal = Array.prototype.slice.call(document.querySelectorAll('div.col-span-7 span') || []).find(function (x) {
          return (x.className || '').indexOf('text-2xl') >= 0;
        });
        if (playersVal) playersVal.textContent = String(p.maxPlayers ?? '');

        var roundsVal = Array.prototype.slice.call(document.querySelectorAll('div.col-span-5 span') || []).find(function (x) {
          return (x.className || '').indexOf('text-4xl') >= 0;
        });
        if (roundsVal) roundsVal.textContent = String(p.rounds ?? '');

        var timeBtns = Array.prototype.slice.call(document.querySelectorAll('section button') || []).filter(function (b) {
          var t = (b.textContent || '').trim();
          return t === '30' || t === '60' || t === '90';
        });
        timeBtns.forEach(function (b) {
          var t = (b.textContent || '').trim();
          var selected = String(p.turnSec ?? '') === t;
          if (selected) {
            b.classList.add('bg-gradient-to-tr');
            b.classList.add('from-primary');
            b.classList.add('to-primary-container');
            b.classList.add('text-on-primary');
            b.classList.add('font-black');
            b.classList.add('shadow-lg');
          } else {
            b.classList.remove('bg-gradient-to-tr');
            b.classList.remove('from-primary');
            b.classList.remove('to-primary-container');
            b.classList.remove('text-on-primary');
            b.classList.remove('font-black');
            b.classList.remove('shadow-lg');
          }
        });

        var toggle = document.querySelector('div.w-14.h-8.bg-primary.rounded-full');
        if (toggle) {
          var pub = Boolean(p.isPublic);
          toggle.style.justifyContent = pub ? 'flex-end' : 'flex-start';
          var right = toggle.parentElement ? toggle.parentElement.querySelector('span.text-xs.font-bold.text-primary') : null;
          var left = toggle.parentElement ? toggle.parentElement.querySelector('span.text-xs.font-bold.text-white\\/40') : null;
          if (right) right.style.opacity = pub ? '1' : '0.35';
          if (left) left.style.opacity = pub ? '0.35' : '1';
        }

        try {
          var rocket = byIcon('rocket_launch');
          if (rocket) {
            var can = Boolean(p.settingsConfirmed);
            rocket.disabled = !can;
            rocket.style.opacity = can ? '1' : '0.5';
            rocket.style.filter = can ? 'none' : 'grayscale(1)';
          }
        } catch (e) {}
      } catch (e) {}
    };
  });
})();
true;
`;
  }, []);

  const injectedPacks = useMemo(() => {
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
        var selected = String(p.selected || '');
        var cards = Array.prototype.slice.call(document.querySelectorAll('div.glass-card.cursor-pointer') || []);
        cards.forEach(function (c) {
          var key = c.getAttribute ? c.getAttribute('data-cat-key') : null;
          if (!key) return;
          var isOn = unlocked.indexOf(key) >= 0 || key === 'All';
          var badge = c.querySelector('span.material-symbols-outlined[data-icon="check"]');
          if (badge) badge.parentElement.parentElement.style.opacity = isOn ? '1' : '0';
          c.style.borderColor = key === selected ? 'rgba(69,253,169,0.8)' : (isOn ? 'rgba(255,176,32,0.6)' : '');
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
      if (e.type === 'input') {
        if (e.id === 'room_name' || e.placeholder?.includes('اكتب اسم')) {
          if (typeof e.value === 'string') setRoomName(e.value);
        }
        return;
      }
      if (e.type !== 'click') return;
      const action = String(e.action ?? '').trim();
      const txt = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      const icon = e.dataIcon ?? null;

      if (action === 'open_packs' || txt === 'إعدادات اللعبة') {
        setShowPacks(true);
        return;
      }

      if (icon === 'home' || txt === 'home') {
        onBack();
        return;
      }

      if (action === 'back' || icon === 'arrow_forward' || txt === 'arrow_forward') {
        onBack();
        return;
      }

      if (action === 'players_inc') setMaxPlayers((n) => Math.min(12, n + 1));
      if (action === 'players_dec') setMaxPlayers((n) => Math.max(2, n - 1));
      if (action === 'rounds_up') setRounds((n) => Math.min(20, n + 1));
      if (action === 'rounds_down') setRounds((n) => Math.max(3, n - 1));
      if (action === 'time_30') setTurnSec(30);
      if (action === 'time_60') setTurnSec(60);
      if (action === 'time_90') setTurnSec(90);
      if (action === 'privacy_toggle') setIsPublic((v) => !v);

      const isCreate = action === 'create_room' || txt.includes('اعمل الأوضة') || icon === 'rocket_launch';
      if (!isCreate) return;
      if (!settingsConfirmed) {
        setShowPacks(true);
        Alert.alert('إعدادات اللعبة', 'لازم تختار إعدادات اللعبة/باقة الكلمات قبل ما تعمل أوضة.');
        return;
      }
      if (loading) return;
      try {
        setLoading(true);
        await gameActions.createRoom({
          name: profileName,
          roomName: roomName.trim().slice(0, 24) || 'لمة الجمعة',
          mode: 'Classic',
          category: selectedCategory,
          maxPlayers,
          maxRounds: rounds,
          turnMs: turnSec * 1000,
          isPublic
        } as any);
        onCreated();
      } catch (err: any) {
        Alert.alert('خطأ', String(err?.message ?? err));
      } finally {
        setLoading(false);
      }
    },
    [isPublic, loading, maxPlayers, onBack, onCreated, profileName, roomName, rounds, selectedCategory, settingsConfirmed, turnSec]
  );

  const onPacksEvent = useCallback(
    async (e: StitchWebEvent) => {
      if (e.type !== 'click') return;
      const action = String(e.action ?? '').trim();
      const txt = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      const icon = e.dataIcon ?? null;

      if (icon === 'home' || icon === 'person' || icon === 'leaderboard' || icon === 'sports_esports') {
        setShowPacks(false);
        return;
      }

      if (action === 'back' || action === 'continue' || icon === 'group' || txt === 'group' || txt === 'كمل') {
        setSettingsConfirmed(true);
        setShowPacks(false);
        return;
      }

      if (action.startsWith('cat:')) {
        const label = action.slice('cat:'.length).trim();
        if (!label) return;
        const cost = 50;
        try {
          if (!unlocked.includes(label)) await gameActions.unlockCategory(label, cost);
          setSelectedCategory(label);
          setSettingsConfirmed(true);
          setShowPacks(false);
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
      }

      if (action.startsWith('catKey:')) {
        const key = action.slice('catKey:'.length).trim();
        if (!key) return;
        const cost = 50;
        try {
          if (!unlocked.includes(key) && key !== 'All') await gameActions.unlockCategory(key, cost);
          setSelectedCategory(key);
          setSettingsConfirmed(true);
          setShowPacks(false);
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
      }
    },
    [unlocked]
  );

  if (showPacks) {
    return (
      <StitchHtmlScreen
        htmlModule={stitchUiHtml.category_packs_screen}
        onEvent={onPacksEvent}
        injectedJavaScript={injectedPacks}
        syncPayload={{ coins, unlocked, selected: selectedCategory }}
      />
    );
  }

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.create_room_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ roomName, maxPlayers, rounds, turnSec, isPublic, selectedCategory, settingsConfirmed }}
    />
  );
}
