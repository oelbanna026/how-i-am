import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { CARD_PLACEHOLDER_DATA_URI } from '../cardImages';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';
import { audioService } from '../audio/audioService';
import { voiceService } from '../audio/voiceService';

export function GameScreen({
  onGoResult,
  onOpenGuessPicker,
  onGoHome,
  onGoProfile,
  onGoScoreboard
}: {
  onGoResult: () => void;
  onOpenGuessPicker?: () => void;
  onGoHome?: () => void;
  onGoProfile?: () => void;
  onGoScoreboard?: () => void;
}) {
  const game = useGameStore((s) => s.gameState);
  const userId = useGameStore((s) => s.userId) ?? '';
  const room = useGameStore((s) => s.currentRoom);
  const [question, setQuestion] = useState('');
  const [reaction, setReaction] = useState<string | null>(null);
  const lastReaction = useGameStore((s) => s.lastReaction);
  const lastToast = useGameStore((s) => s.lastToast);
  const lastTickSecRef = useRef<number | null>(null);
  const prevIsMyTurnRef = useRef<boolean | null>(null);
  const prevTimeUpRef = useRef<boolean>(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const isMyTurn = game?.currentTurn === userId;
  const latestQ = game?.questions?.[0] ?? null;
  const myNeedAnswer = latestQ && latestQ.askedBy !== userId && latestQ.answers?.[userId] === null;

  React.useEffect(() => {
    if (game?.flow === 'ended') onGoResult();
  }, [game?.flow, onGoResult]);

  if (!game) return null;

  const offline = String(room?.roomCode ?? '') === 'OFFLINE';
  const offlineState = game?.offline ?? null;
  const latestQuestion = game?.questions?.[0] ?? null;
  const latestAnswers = latestQuestion && typeof (latestQuestion as any).answers === 'object' ? (latestQuestion as any).answers : null;
  const answerMode =
    !offline &&
    Boolean(latestQuestion?.id) &&
    String((latestQuestion as any)?.askedBy ?? '') !== String(userId) &&
    latestAnswers &&
    Object.prototype.hasOwnProperty.call(latestAnswers, String(userId)) &&
    latestAnswers[String(userId)] == null;
  const questionOpen =
    Boolean(latestQuestion?.id) && latestAnswers ? Object.values(latestAnswers).some((v: any) => v == null) : false;
  const isAiTurn = offline && !isMyTurn && String(latestQ?.askedBy ?? '') === 'bot_ai_1';
  const questionsCount = Array.isArray((game as any)?.questions) ? (game as any).questions.length : 0;
  const canGuess = offline ? true : isMyTurn && questionsCount >= 3;

  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), 650);
    return () => clearTimeout(t);
  }, [reaction]);

  useEffect(() => {
    const txt =
      reaction != null
        ? `تم إرسال ${reaction}`
        : lastToast?.text
          ? String(lastToast.text)
          : lastReaction?.emoji && lastReaction?.fromName
            ? `${lastReaction.fromName} ${lastReaction.emoji}`
            : null;
    if (!txt) return;
    setToastText(txt);
    const t = setTimeout(() => setToastText(null), 1600);
    return () => clearTimeout(t);
  }, [lastReaction?.emoji, lastReaction?.fromName, lastToast?.text, reaction]);

  useEffect(() => {
    const prev = prevIsMyTurnRef.current;
    prevIsMyTurnRef.current = isMyTurn;
    if (prev === null) return;
    if (!prev && isMyTurn) voiceService.playVoice('your_turn');
  }, [isMyTurn]);

  const injected = useMemo(() => {
    const placeholderImage = JSON.stringify(CARD_PLACEHOLDER_DATA_URI);
    return `
(function () {
  var PLACEHOLDER_IMAGE = ${placeholderImage};
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function norm(s) {
    return String(s || '').replace(/\\s+/g, ' ').trim();
  }
  function setText(el, t) {
    try { if (el) el.textContent = String(t ?? ''); } catch (e) {}
  }
  function rememberImage(el) {
    try {
      if (!el || el.getAttribute('data-rn-orig-src')) return;
      el.setAttribute('data-rn-orig-src', el.getAttribute('src') || '');
      el.setAttribute('data-rn-orig-class', el.className || '');
    } catch (e) {}
  }
  function resetImage(el) {
    try {
      if (!el) return;
      rememberImage(el);
      el.setAttribute('src', el.getAttribute('data-rn-orig-src') || PLACEHOLDER_IMAGE);
      el.className = el.getAttribute('data-rn-orig-class') || el.className || '';
      el.style.filter = '';
      el.style.opacity = '1';
    } catch (e) {}
  }
  function loadImage(el, src) {
    try {
      if (!el) return;
      rememberImage(el);
      var nextSrc = String(src || '').trim() || PLACEHOLDER_IMAGE;
      el.style.opacity = '1';
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
    try {
      var sendBtn = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
        return norm(b.textContent).indexOf('send') >= 0;
      });
      if (sendBtn) sendBtn.setAttribute('data-stitch-action', 'send_question');
    } catch (e) {}

    try {
      var qBtns = Array.prototype.slice.call(document.querySelectorAll('section.flex.flex-col.gap-4 button') || []);
      qBtns.forEach(function (b) { b.setAttribute('data-stitch-tap', '1'); });
    } catch (e) {}

    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var offline = Boolean(p.offline);
        var isMyTurn = Boolean(p.isMyTurn);
        var answerMode = Boolean(p.answerMode);

        try {
          var timerEl = document.querySelector('header span.font-mono');
          if (timerEl && p.timerText) setText(timerEl, p.timerText);
        } catch (e) {}

        try {
          var roundEl = Array.prototype.slice.call(document.querySelectorAll('header span') || []).find(function (s) {
            return norm(s.textContent).indexOf('Round') === 0;
          });
          if (roundEl && p.roundText) setText(roundEl, p.roundText);
        } catch (e) {}

        try {
          var img = document.querySelector('main img[alt="Blurred mystery object"]');
          var opponentImg = document.querySelector('main img[alt="Opponent card"]');
          var helpIcon = document.querySelector('main span.material-symbols-outlined.animate-pulse');
          var title = document.querySelector('main h2');
          var sub = document.querySelector('main p');
          rememberImage(img);
          rememberImage(opponentImg);
          if (!offline && typeof p.opponentImageUri === 'string' && p.opponentImageUri) {
            if (opponentImg) loadImage(opponentImg, p.opponentImageUri);
            if (img) resetImage(img);
            if (helpIcon) helpIcon.style.display = '';
            if (title && !answerMode) title.textContent = (typeof p.opponentName === 'string' && p.opponentName) ? ('خصمك: ' + p.opponentName) : 'خصمك';
            if (sub && !answerMode) sub.textContent = isMyTurn ? 'إسأل عشان تعرف نفسك' : 'جاوب على سؤاله';
            try {
              if (title) title.style.textShadow = '';
              if (sub) sub.style.textShadow = '';
            } catch (e) {}
          } else if (offline && !isMyTurn && typeof p.botImageUri === 'string') {
            if (opponentImg) loadImage(opponentImg, p.botImageUri);
            if (img) resetImage(img);
            if (helpIcon) helpIcon.style.display = '';
            if (title && typeof p.activeQuestionText === 'string' && p.activeQuestionText) title.textContent = p.activeQuestionText;
            else if (title) title.textContent = 'سؤال الكمبيوتر';
            if (sub) sub.textContent = 'جاوب: أيوه / لأ / ممكن / سكيب';
            try {
              if (title) title.style.textShadow = '';
              if (sub) sub.style.textShadow = '';
            } catch (e) {}
          } else {
            if (img) resetImage(img);
            if (opponentImg) resetImage(opponentImg);
            if (helpIcon) helpIcon.style.display = '';
            if (title) title.textContent = 'مين ده؟';
            if (sub) sub.textContent = 'إسأل زمايلك عشان تعرف';
          }
        } catch (e) {}

        try {
          if (!offline) {
            var title2 = document.querySelector('main h2');
            var sub2 = document.querySelector('main p');
            var help2 = document.querySelector('main span.material-symbols-outlined.animate-pulse');
            if (answerMode && typeof p.questionText === 'string' && p.questionText) {
              if (title2) title2.textContent = p.questionText;
              if (sub2) sub2.textContent = 'جاوب على السؤال';
              if (help2) help2.style.display = 'none';
              try {
                if (title2) title2.style.textShadow = '0 6px 18px rgba(0,0,0,0.75)';
                if (sub2) sub2.style.textShadow = '0 6px 18px rgba(0,0,0,0.75)';
              } catch (e) {}
            } else if (isMyTurn) {
              if (title2) title2.textContent = 'مين ده؟';
              if (sub2) sub2.textContent = 'إسأل زمايلك عشان تعرف';
              if (help2) help2.style.display = '';
            }
          }
        } catch (e) {}

        var answerTitle = Array.prototype.slice.call(document.querySelectorAll('h3') || []).find(function (h) {
          return norm(h.textContent).indexOf('أديله إجابة') >= 0;
        });
        if (answerTitle) {
          var wrap = answerTitle.parentElement;
          if (wrap) {
            if (offline) wrap.style.display = (isMyTurn ? 'none' : '');
            else wrap.style.display = answerMode ? '' : 'none';
          }
        }

        var inputSection = document.querySelector('section.flex.flex-col.gap-4');
        if (inputSection) {
          var banner = document.getElementById('rn-ai-answer');
          if (!banner) {
            banner = document.createElement('div');
            banner.id = 'rn-ai-answer';
            banner.style.marginTop = '10px';
            banner.style.padding = '10px 12px';
            banner.style.borderRadius = '14px';
            banner.style.background = 'rgba(255,255,255,0.06)';
            banner.style.border = '1px solid rgba(255,176,32,0.18)';
            banner.style.color = '#eef0fc';
            banner.style.fontWeight = '800';
            banner.style.textAlign = 'center';
            banner.style.display = 'none';
            inputSection.appendChild(banner);
          }
          if (offline && isMyTurn) {
            banner.style.display = 'block';
            if (p.waitingAi) {
              banner.textContent = 'الكمبيوتر يجاوب...';
              banner.style.borderColor = 'rgba(255,255,255,0.12)';
            } else if (p.guessWrong) {
              banner.textContent = 'تخمين غلط';
              banner.style.borderColor = 'rgba(255,115,81,0.35)';
            } else if (p.aiAnswer) {
              var t = String(p.aiAnswer) === 'YES' ? 'أيوه' : (String(p.aiAnswer) === 'NO' ? 'لأ' : String(p.aiAnswer));
              banner.textContent = 'إجابة الكمبيوتر: ' + t;
              banner.style.borderColor = t === 'أيوه' ? 'rgba(69,253,169,0.35)' : 'rgba(255,115,81,0.35)';
            } else {
              banner.textContent = 'اسأل سؤال نعم/لا وسنجيبك فوراً';
              banner.style.borderColor = 'rgba(255,176,32,0.18)';
            }
          } else {
            banner.style.display = 'none';
          }
        }

        try {
          var guessBtn = Array.prototype.slice.call(document.querySelectorAll('main button') || []).find(function (b) {
            return norm(b.textContent).indexOf('أنا فاكر إني') >= 0;
          });
          if (offline && !isMyTurn) {
            if (inputSection) inputSection.style.display = 'none';
            if (guessBtn) guessBtn.style.display = 'none';
          } else {
            if (inputSection) inputSection.style.display = '';
            if (guessBtn) guessBtn.style.display = '';
          }
        } catch (e) {}

        try {
          if (!offline) {
            var sendBtn2 = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
              return norm(b.textContent).indexOf('send') >= 0;
            });
            var qBtns2 = Array.prototype.slice.call(document.querySelectorAll('section.flex.flex-col.gap-4 button') || []);
            var disableAsk = Boolean(p.questionOpen) || !isMyTurn;
            qBtns2.forEach(function (b) {
              b.disabled = disableAsk;
              b.style.opacity = disableAsk ? '0.55' : '1';
            });
            if (sendBtn2) {
              sendBtn2.disabled = disableAsk;
              sendBtn2.style.opacity = disableAsk ? '0.55' : '1';
            }

            if (inputSection) inputSection.style.display = isMyTurn ? '' : 'none';
            if (guessBtn) {
              guessBtn.style.display = isMyTurn ? '' : 'none';
              guessBtn.disabled = !Boolean(p.canGuess);
              guessBtn.style.opacity = Boolean(p.canGuess) ? '1' : '0.55';
            }
          }
        } catch (e) {}

        try {
          var toast = document.getElementById('rn-toast');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'rn-toast';
            toast.style.position = 'fixed';
            toast.style.left = '50%';
            toast.style.bottom = '160px';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '10px 14px';
            toast.style.borderRadius = '999px';
            toast.style.background = 'rgba(0,0,0,0.65)';
            toast.style.border = '1px solid rgba(255,255,255,0.12)';
            toast.style.color = '#eef0fc';
            toast.style.fontWeight = '900';
            toast.style.zIndex = '99999';
            toast.style.display = 'none';
            document.body.appendChild(toast);
          }
          if (p.toastText) {
            toast.textContent = String(p.toastText);
            toast.style.display = 'block';
          } else {
            toast.style.display = 'none';
          }
        } catch (e) {}
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
        setQuestion(String(e.value ?? ''));
        return;
      }
      if (e.type !== 'click') return;

      const clickText = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      const icon = e.dataIcon ?? null;
      const action = String(e.action ?? '').trim();

      if (clickText === '🔥' || clickText === '😂' || clickText === '🤔' || clickText === '💀' || clickText === '👏') {
        setReaction(clickText);
        try {
          await gameActions.sendReaction(clickText);
        } catch {}
        return;
      }

      if (icon === 'home' || clickText === 'home') {
        onGoHome?.();
        return;
      }
      if (icon === 'person' || clickText === 'person') {
        onGoProfile?.();
        return;
      }
      if (icon === 'leaderboard' || clickText === 'leaderboard') {
        onGoScoreboard?.();
        return;
      }
      if (action === 'send_question' || clickText === 'send' || clickText.includes('send')) {
        if (!isMyTurn) return;
        const q = question.trim();
        if (!q) return;
        try {
          await gameActions.sendQuestion(q);
          setQuestion('');
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
        return;
      }

      if (clickText.includes('أيوه') || clickText.includes('check_circle')) {
        if (!latestQ?.id) return;
        if (offline && isAiTurn) {
          await gameActions.sendAnswer(latestQ.id, 'YES');
          return;
        }
        if (!myNeedAnswer) return;
        await gameActions.sendAnswer(latestQ.id, 'YES');
        return;
      }

      if (clickText === 'لأ' || clickText.includes('لأ') || clickText.includes('cancel')) {
        if (!latestQ?.id) return;
        if (offline && isAiTurn) {
          await gameActions.sendAnswer(latestQ.id, 'NO');
          return;
        }
        if (!myNeedAnswer) return;
        await gameActions.sendAnswer(latestQ.id, 'NO');
        return;
      }

      if (clickText.includes('ممكن') || clickText.includes('help')) {
        if (!latestQ?.id) return;
        if (offline && isAiTurn) await gameActions.sendAnswer(latestQ.id, 'MAYBE');
        return;
      }

      if (clickText.includes('سكيب') || clickText.includes('fast_forward')) {
        if (!latestQ?.id) return;
        if (offline && isAiTurn) await gameActions.sendAnswer(latestQ.id, 'SKIP');
        return;
      }

      if (clickText.includes('أنا فاكر إني')) {
        if (!canGuess) {
          const remaining = Math.max(0, 3 - questionsCount);
          Alert.alert('لا يمكن التخمين الآن', `لازم تسأل ${remaining} سؤال قبل التخمين.`);
          return;
        }
        onOpenGuessPicker?.();
        return;
      }

      if (isMyTurn && (clickText.endsWith('?') || clickText.endsWith('؟') || clickText.includes('?') || clickText.includes('؟'))) {
        try {
          await gameActions.sendQuestion(clickText);
          setQuestion('');
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
      }
    },
    [canGuess, isAiTurn, isMyTurn, latestQ?.id, myNeedAnswer, offline, onGoHome, onGoProfile, onGoScoreboard, onOpenGuessPicker, question, questionsCount]
  );

  const endsAt = typeof game?.timer?.turnEndsAt === 'number' ? game.timer.turnEndsAt : null;
  const remainingSec = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null;
  const mm = remainingSec !== null ? String(Math.floor(remainingSec / 60)).padStart(2, '0') : null;
  const ss = remainingSec !== null ? String(remainingSec % 60).padStart(2, '0') : null;
  const timerText = mm && ss ? `${mm}:${ss}` : null;
  const roundText =
    offline && offlineState?.round && offlineState?.maxRounds ? `Round ${offlineState.round}/${offlineState.maxRounds}` : null;

  const opponent = useMemo(() => {
    const ps = Array.isArray((game as any)?.players) ? (game as any).players : [];
    return ps.find((p: any) => String(p?.id ?? '') && String(p.id) !== String(userId)) ?? null;
  }, [game, userId]);
  const opponentImageUri = !offline ? (String(opponent?.card?.imageUri ?? '').trim() || null) : null;
  const opponentName = !offline ? (String(opponent?.name ?? '').trim() || null) : null;

  useEffect(() => {
    if (remainingSec === null) return;
    if (remainingSec === lastTickSecRef.current) return;
    lastTickSecRef.current = remainingSec;
    if (remainingSec <= 0) return;
    if (remainingSec <= 5) void audioService.playSFX('timer_warning');
    else if (remainingSec <= 10) void audioService.playSFX('timer_tick');
  }, [remainingSec]);

  useEffect(() => {
    if (remainingSec === null) return;
    const timeUp = remainingSec <= 0;
    if (timeUp && !prevTimeUpRef.current) voiceService.playVoice('time_up');
    prevTimeUpRef.current = timeUp;
  }, [remainingSec]);
  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.gameplay_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{
        offline,
        isMyTurn,
        answerMode,
        questionOpen,
        questionText: typeof (latestQuestion as any)?.text === 'string' ? String((latestQuestion as any).text) : null,
        canGuess,
        waitingAi: Boolean(offlineState?.waiting),
        aiAnswer: offlineState?.lastAnswer ?? null,
        guessWrong: Boolean(offlineState?.lastGuessCorrect === false),
        botImageUri: offlineState?.botCard?.imageUri ?? null,
        activeQuestionText: typeof latestQ?.text === 'string' ? latestQ.text : null,
        opponentImageUri,
        opponentName,
        toastText,
        timerText,
        roundText
      }}
    />
  );
}
