import React, { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function HomeScreen({
  onGoCreate,
  onGoJoin,
  onGoProfile,
  onGoScoreboard,
  onGoRoom
}: {
  onGoCreate: () => void;
  onGoJoin: () => void;
  onGoProfile: () => void;
  onGoScoreboard: () => void;
  onGoRoom: () => void;
}) {
  const connected = useGameStore((s) => s.connected);
  const connecting = useGameStore((s) => s.connecting);
  const error = useGameStore((s) => s.error);
  const serverUrl = useGameStore((s) => s.serverUrl);
  const profile = useGameStore((s) => s.profile);
  const recentPlayers = useGameStore((s) => s.recentPlayers);

  const friends = useMemo(() => {
    return recentPlayers.slice(0, 10).map((p) => ({ id: p.id, name: p.name }));
  }, [recentPlayers]);

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
  function safeText(el, text) {
    try { if (el) el.textContent = String(text ?? ''); } catch (e) {}
  }
  function findNameEl() {
    try {
      var el = document.querySelector('header span.text-\\[\\#FFB020\\]');
      if (el) return el;
    } catch (e) {}
    return null;
  }
  function findCoinsEl() {
    try {
      var el = document.querySelector('header .text-error.font-black');
      if (el) return el;
    } catch (e) {}
    return null;
  }
  function findFriendsRow() {
    try {
      var title = Array.prototype.slice.call(document.querySelectorAll('h3') || []).find(function (h) {
        return (h.textContent || '').trim() === 'أصحابك المتصلين';
      });
      if (!title) return null;
      var section = title.parentElement && title.parentElement.parentElement ? title.parentElement.parentElement : null;
      if (!section) return null;
      var row = section.querySelector('div.flex.gap-4.overflow-x-auto');
      return row || null;
    } catch (e) {}
    return null;
  }

  var __roomsLastFetch = 0;
  var __roomsCache = null;

  function renderRooms(row, rooms) {
    try {
      while (row.firstChild) row.removeChild(row.firstChild);
      (rooms || []).slice(0, 10).forEach(function (r) {
        var code = String(r.roomCode || r.code || '').toUpperCase();
        if (!code) return;
        var name = String(r.roomName || 'Room');
        var count = Number(r.playersCount || (Array.isArray(r.players) ? r.players.length : 0) || 0);

        var wrap = document.createElement('div');
        wrap.className = 'flex-shrink-0 flex flex-col items-center gap-2';
        wrap.setAttribute('data-stitch-tap', '1');
        wrap.setAttribute('data-stitch-action', 'join_public:' + code);

        var avatarWrap = document.createElement('div');
        avatarWrap.className = 'w-16 h-16 rounded-full border-2 border-secondary p-0.5';
        var inner = document.createElement('div');
        inner.className = 'w-full h-full rounded-full bg-surface-container-highest flex flex-col items-center justify-center';
        inner.textContent = (name ? name.slice(0, 1) : 'R');
        avatarWrap.appendChild(inner);

        var title = document.createElement('span');
        title.className = 'text-xs font-bold';
        title.textContent = code;

        var sub = document.createElement('span');
        sub.className = 'text-[10px] font-black text-secondary';
        sub.textContent = (count ? (count + '/2') : '0/2');

        wrap.appendChild(avatarWrap);
        wrap.appendChild(title);
        wrap.appendChild(sub);
        row.appendChild(wrap);
      });
    } catch (e) {}
  }

  function ensureRooms(p) {
    try {
      var row = findFriendsRow();
      if (!row) return;

      var title = Array.prototype.slice.call(document.querySelectorAll('h3') || []).find(function (h) {
        return norm(h.textContent) === 'أصحابك المتصلين';
      });
      if (title) title.textContent = 'غرف عامة';

      var showAll = Array.prototype.slice.call(document.querySelectorAll('span') || []).find(function (s) {
        return norm(s.textContent) === 'عرض الكل';
      });
      if (showAll) {
        showAll.setAttribute('data-stitch-tap', '1');
        showAll.setAttribute('data-stitch-action', 'refresh_rooms');
        showAll.style.cursor = 'pointer';
      }

      var now = Date.now();
      if (__roomsCache && now - __roomsLastFetch < 8000) {
        renderRooms(row, __roomsCache);
        return;
      }

      var base = String(p.serverUrl || '').replace(/\\/+$/, '');
      if (!base) return;
      __roomsLastFetch = now;

      fetch(base + '/rooms')
        .then(function (r) { return r.json(); })
        .then(function (json) {
          var rooms = (json && json.rooms) ? json.rooms : [];
          __roomsCache = rooms;
          renderRooms(row, rooms);
        })
        .catch(function () {});
    } catch (e) {}
  }

  window.__RN_SYNC = function (payload) {
    try {
      var p = payload || {};
      safeText(findNameEl(), p.profileName || 'Guest');
      safeText(findCoinsEl(), String(p.coins ?? '0'));

      ensureRooms(p);
    } catch (e) {}
  };

  function addOfflineButton() {
    try {
      var ctas = document.querySelector('section.grid.grid-cols-1.gap-6');
      if (!ctas) return;
      if (document.getElementById('offline_ai_btn')) return;
      var btns = Array.prototype.slice.call(ctas.querySelectorAll('button') || []);
      var joinBtn = btns[1] || btns[0] || null;
      if (!joinBtn) return;
      var offline = joinBtn.cloneNode(true);
      offline.id = 'offline_ai_btn';
      offline.setAttribute('data-stitch-action', 'offline_ai');
      offline.className = String(offline.className || '')
        .replace('from-[#1a73e8]', 'from-[#7c3aed]')
        .replace('to-[#63b3ed]', 'to-[#a78bfa]');
      var icon = offline.querySelector('span.material-symbols-outlined');
      if (icon) icon.textContent = 'smart_toy';
      var texts = offline.querySelectorAll('span');
      if (texts && texts[1]) texts[1].textContent = 'العب مع الكمبيوتر';
      if (texts && texts[2]) texts[2].textContent = 'جرب اللعبة أوفلاين';
      ctas.appendChild(offline);
    } catch (e) {}
  }

  onReady(function () { try { addOfflineButton(); } catch (e) {} });
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

      const ensureOnline = async () => {
        if (connecting) return false;
        if (connected) return true;
        try {
          await gameActions.connectSocket();
          return true;
        } catch {
          Alert.alert('غير متصل', `تأكد إن السيرفر شغال: ${serverUrl}\n${error ? `\n${error}` : ''}`);
          return false;
        }
      };

      if (txt.includes('اعمل أوضة')) {
        const ok = await ensureOnline();
        if (!ok) return;
        onGoCreate();
        return;
      }

      if (txt.includes('ادخل بكود')) {
        const ok = await ensureOnline();
        if (!ok) return;
        onGoJoin();
        return;
      }

      if (txt.includes('طريقة اللعب')) {
        Alert.alert(
          'طريقة اللعب',
          'اسأل أسئلة نعم/لا في دورك.\nاللاعبين يجاوبوا.\nبعد 3 أسئلة تقدر تخمّن.\nاللعبة 3 جولات.\nالتخمين الصح ينهي الجولة.'
        );
        return;
      }

      if (action === 'refresh_rooms') {
        const ok = await ensureOnline();
        if (!ok) return;
        await gameActions.connectSocket();
        return;
      }

      if (action.startsWith('join_public:')) {
        const ok = await ensureOnline();
        if (!ok) return;
        const code = action.slice('join_public:'.length).trim();
        if (!code) return;
        try {
          await gameActions.joinRoom(code, profile.name);
          onGoRoom();
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
        return;
      }

      if (txt.includes('Daily Challenge')) {
        Alert.alert('Daily Challenge', 'قريبًا');
        return;
      }

      if (icon === 'person' || txt === 'person') {
        onGoProfile();
        return;
      }

      if (icon === 'leaderboard' || txt === 'leaderboard') {
        onGoScoreboard();
        return;
      }

      if (icon === 'sports_esports' || txt === 'sports_esports') {
        const ok = await ensureOnline();
        if (!ok) return;
        onGoCreate();
        return;
      }

      if (action === 'offline_ai' || txt.includes('العب مع الكمبيوتر')) {
        await gameActions.startOfflineGame();
        onGoRoom();
        return;
      }

      if (icon === 'home' || txt === 'home') {
        return;
      }
    },
    [connected, connecting, error, onGoCreate, onGoJoin, onGoProfile, onGoRoom, onGoScoreboard, profile.name, serverUrl]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.home_play_hub}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ profileName: profile.name, coins: profile.coins, friends, serverUrl }}
    />
  );
}
