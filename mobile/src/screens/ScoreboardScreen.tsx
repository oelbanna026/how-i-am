import React, { useCallback, useMemo } from 'react';
import { gameActions, useGameStore } from '../gameStore';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { stitchUiHtml } from '../stitchUiAssets';

export function ScoreboardScreen({
  onBackToHome,
  onGoProfile,
  onGoCategories
}: {
  onBackToHome: () => void;
  onGoProfile?: () => void;
  onGoCategories?: () => void;
}) {
  const game = useGameStore((s) => s.gameState);
  const players = useGameStore((s) => s.players);
  const myId = useGameStore((s) => s.userId);

  const leaderboard = useMemo(() => {
    if (Array.isArray(game?.scoreboard)) {
      return game.scoreboard
        .map((x: any) => ({ playerId: String(x.playerId ?? ''), name: String(x.name ?? ''), score: Number(x.score ?? 0) }))
        .filter((x: any) => x.playerId && x.name)
        .sort((a: any, b: any) => b.score - a.score);
    }
    const scores = game?.scores ?? null;
    if (!scores) return [];
    return (players ?? [])
      .map((p: any) => ({ playerId: String(p.id ?? ''), name: String(p.name ?? ''), score: Number(scores[p.id] ?? p.score ?? 0) }))
      .filter((x: any) => x.playerId && x.name)
      .sort((a: any, b: any) => b.score - a.score);
  }, [game?.scoreboard, game?.scores, players]);

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function fmt(n) {
    try { return Number(n || 0).toLocaleString('en-US'); } catch (e) { return String(n || 0); }
  }
  function setText(el, t) {
    try { if (el) el.textContent = String(t ?? ''); } catch (e) {}
  }

  onReady(function () {
    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var list = Array.isArray(p.leaderboard) ? p.leaderboard : [];

        var podium = document.querySelector('main section.space-y-4');
        if (podium && list.length) {
          var rank1 = podium.querySelector('div.glass-card');
          if (rank1) {
            setText(rank1.querySelector('h3.text-2xl'), list[0] ? list[0].name : '—');
            setText(rank1.querySelector('span.block.text-primary.font-black'), fmt(list[0] ? list[0].score : 0));
          }

          var grid = podium.querySelector('div.grid.grid-cols-2');
          if (grid) {
            var cols = grid.querySelectorAll('div.bg-surface-container-high');
            var r2 = cols && cols[0] ? cols[0] : null;
            var r3 = cols && cols[1] ? cols[1] : null;
            if (r2) {
              setText(r2.querySelector('p.font-bold'), list[1] ? list[1].name : '—');
              setText(r2.querySelector('p.text-secondary-dim'), fmt(list[1] ? list[1].score : 0));
            }
            if (r3) {
              setText(r3.querySelector('p.font-bold'), list[2] ? list[2].name : '—');
              setText(r3.querySelector('p.text-tertiary'), fmt(list[2] ? list[2].score : 0));
            }
          }
        }

        var othersSection = Array.prototype.slice.call(document.querySelectorAll('main section') || []).find(function (s) {
          var h4 = s.querySelector('h4');
          return h4 && ((h4.textContent || '').indexOf('باقي الشلة') >= 0);
        });
        if (othersSection) {
          var header = othersSection.querySelector('h4');
          var template = othersSection.querySelector('div.flex.items-center.justify-between');
          if (header && template) {
            var keep = [header];
            othersSection.innerHTML = '';
            othersSection.appendChild(header);

            for (var i = 3; i < list.length; i += 1) {
              var item = template.cloneNode(true);
              item.classList.remove('bg-primary-container/20');
              item.classList.remove('ring-1');
              item.classList.remove('ring-primary/30');
              var rankSpan = item.querySelector('span.w-4');
              var nameP = item.querySelector('p.font-bold');
              var scoreP = item.querySelector('div.text-right p.font-black');
              setText(rankSpan, String(i + 1));
              setText(nameP, list[i].name);
              setText(scoreP, fmt(list[i].score));

              if (String(p.meId || '') && String(p.meId) === String(list[i].playerId)) {
                item.classList.add('bg-primary-container/20');
                item.classList.add('ring-1');
                item.classList.add('ring-primary/30');
              }
              othersSection.appendChild(item);
            }
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
    async (e: StitchWebEvent) => {
      if (e.type !== 'click') return;
      const icon = e.dataIcon ?? null;
      const txt = String(e.text ?? '').trim();
      if (icon === 'person' || txt === 'person') {
        onGoProfile?.();
        return;
      }
      if (icon === 'leaderboard' || txt === 'leaderboard') return;
      if (txt === 'play_arrow' || icon === 'play_arrow' || txt === 'home' || icon === 'home') {
        await gameActions.leaveRoom();
        onBackToHome();
        return;
      }
      if (game?.flow !== 'ended' && (txt === 'sports_esports' || icon === 'sports_esports')) {
        await gameActions.leaveRoom();
        onBackToHome();
      }
    },
    [game?.flow, onBackToHome, onGoCategories, onGoProfile]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.scoreboard_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ meId: myId ?? null, leaderboard }}
    />
  );
}
