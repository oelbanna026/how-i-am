import React, { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function RoomScreen({ onGoGame, onBackToHome }: { onGoGame: () => void; onBackToHome: () => void }) {
  const room = useGameStore((s) => s.currentRoom);
  const players = useGameStore((s) => s.players);
  const userId = useGameStore((s) => s.userId);
  const gameState = useGameStore((s) => s.gameState);
  const profileName = useGameStore((s) => s.profile.name);

  const me = useMemo(() => players.find((p) => p.id === userId) ?? null, [players, userId]);
  const isHost = room?.hostId && userId ? room.hostId === userId : false;
  const allReady = players.length >= 2 && players.every((p) => Boolean(p.ready));

  React.useEffect(() => {
    if (gameState?.flow === 'playing') onGoGame();
  }, [gameState?.flow, onGoGame]);

  if (!room) return null;

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(function () {
    try {
      var leaveIcon = Array.prototype.slice.call(document.querySelectorAll('span.material-symbols-outlined') || []).find(function (s) {
        return (s.textContent || '').trim() === 'group';
      });
      var leaveBtn = leaveIcon && leaveIcon.closest ? leaveIcon.closest('button') : null;
      if (leaveBtn) leaveBtn.setAttribute('data-stitch-action', 'leave_room');
    } catch (e) {}

    try {
      var startBtn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
        return ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '').indexOf('ابدأ') >= 0;
      });
      if (startBtn) startBtn.setAttribute('data-stitch-action', 'start_game');
    } catch (e) {}

    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var roomName = String(p.roomName || '—');
        var roomCode = String(p.roomCode || '').toUpperCase();

        var title = document.querySelector('header h1');
        if (title) title.textContent = roomName;

        var codeEl = Array.prototype.slice.call(document.querySelectorAll('header span') || []).find(function (s) {
          return (s.className || '').indexOf('tracking-widest') >= 0;
        });
        if (codeEl && roomCode) codeEl.textContent = roomCode;

        var grid = document.querySelector('main .grid.grid-cols-2');
        if (grid && Array.isArray(p.players)) {
          while (grid.firstChild) grid.removeChild(grid.firstChild);
          p.players.forEach(function (pl) {
            var id = String(pl.id || '');
            var name = String(pl.name || '');
            var ready = Boolean(pl.ready);
            var isHost = String(p.hostId || '') === id;
            var isMe = String(p.meId || '') === id;

            var card = document.createElement('div');
            card.className = 'relative bg-surface-container-low p-5 rounded-xl border border-outline-variant/10 flex flex-col items-center justify-center text-center';
            if (isHost) card.className = 'relative bg-surface-container-high p-5 rounded-xl border border-primary/10 flex flex-col items-center justify-center text-center';
            if (isMe) card.className += ' ring-1 ring-primary/30';

            card.setAttribute('data-stitch-tap', '1');
            card.setAttribute('data-stitch-action', isMe ? 'toggle_ready' : ('player:' + id));

            var avatarWrap = document.createElement('div');
            avatarWrap.className = 'relative mb-3';
            var avatar = document.createElement('div');
            avatar.className = 'w-20 h-20 rounded-full border-2 border-secondary bg-surface-container-highest flex items-center justify-center text-2xl font-black';
            if (isHost) avatar.className = 'w-20 h-20 rounded-full border-4 border-primary bg-surface-container-highest flex items-center justify-center text-2xl font-black';
            avatar.textContent = name ? name.slice(0, 1) : '?';
            avatarWrap.appendChild(avatar);

            if (isHost) {
              var hostBadge = document.createElement('div');
              hostBadge.className = 'absolute -bottom-1 -right-1 bg-primary text-on-primary-container p-1 rounded-full border-2 border-surface-container-high';
              var hostIcon = document.createElement('span');
              hostIcon.className = 'material-symbols-outlined text-sm';
              hostIcon.textContent = 'star';
              hostBadge.appendChild(hostIcon);
              avatarWrap.appendChild(hostBadge);
            } else if (ready) {
              var readyBadge = document.createElement('div');
              readyBadge.className = 'absolute -bottom-1 -right-1 bg-secondary text-on-secondary p-1 rounded-full';
              var readyIcon = document.createElement('span');
              readyIcon.className = 'material-symbols-outlined text-sm';
              readyIcon.textContent = 'check';
              readyBadge.appendChild(readyIcon);
              avatarWrap.appendChild(readyBadge);
            }

            var h3 = document.createElement('h3');
            h3.className = 'font-bold text-on-surface';
            h3.textContent = isHost ? (name + ' (Host)') : name;

            var sub = document.createElement('span');
            sub.className = 'text-[10px] font-black uppercase mt-1';
            if (isMe) {
              sub.textContent = ready ? 'جاهز' : 'غير جاهز';
              sub.style.color = ready ? '#2eee9c' : '#a8abb6';
            } else {
              sub.textContent = ready ? 'جاهز' : (pl.connected ? 'متصل' : 'غير متصل');
              sub.style.color = ready ? '#2eee9c' : '#a8abb6';
            }

            card.appendChild(avatarWrap);
            card.appendChild(h3);
            card.appendChild(sub);
            grid.appendChild(card);
          });
        }

        var startBtn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
          return ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '').indexOf('ابدأ') >= 0;
        });
        if (startBtn) {
          var canStart = Boolean(p.canStart);
          startBtn.disabled = !canStart;
          startBtn.style.opacity = canStart ? '1' : '0.5';
        }
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

      if (action === 'leave_room' || icon === 'group' || txt === 'group') {
        await gameActions.leaveRoom();
        onBackToHome();
        return;
      }

      if (action === 'toggle_ready') {
        try {
          await gameActions.setReady(!me?.ready);
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
        return;
      }

      if (action.startsWith('player:')) {
        const pid = action.slice('player:'.length);
        if (pid) {
          gameActions.setReportTargetUserId(pid);
          Alert.alert('إبلاغ', 'تم اختيار اللاعب. افتح صفحة البلاغ من الإعدادات.');
        }
        return;
      }

      if (txt.includes('القواعد')) {
        Alert.alert('القواعد في 20 ثانية', 'كل لاعب يسأل في دوره.\nالباقي يجاوبوا.\nبعد 3 أسئلة تقدر تخمّن.\nالصح ينهي اللعبة.');
        return;
      }

      if (action === 'start_game' || txt.includes('ابدأ')) {
        if (!isHost || !allReady) return;
        try {
          await gameActions.startGame();
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
      }
    },
    [allReady, isHost, me?.name, me?.ready, onBackToHome, profileName]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.lobby_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{
        roomName: room?.roomName ?? room?.name ?? room?.roomCode ?? '—',
        roomCode: room?.roomCode ?? room?.code ?? '',
        hostId: room?.hostId ?? null,
        meId: userId ?? null,
        canStart: Boolean(isHost && allReady),
        players: (players ?? []).map((p: any) => ({
          id: String(p.id ?? ''),
          name: String(p.name ?? ''),
          ready: Boolean(p.ready),
          connected: Boolean(p.connected)
        }))
      }}
    />
  );
}
