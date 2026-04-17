import React, { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function GuessPickerScreen({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(function () {
    try {
      var overlay = document.querySelector('div.fixed.inset-0.bg-black\\/60');
      if (overlay && overlay.setAttribute) overlay.setAttribute('data-stitch-tap', '1');
    } catch (e) {}
  });
})();
true;
`;
  }, []);

  const extractGuess = useCallback((raw: string) => {
    const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return null;
    if (cleaned.includes('ثبّت التخمين')) return null;
    if (cleaned.includes('اختر تخمينك')) return null;
    const tokens = cleaned
      .split(' ')
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !['add_circle', 'history', 'timer', 'group', 'share', 'search', 'help_outline'].includes(t));
    if (!tokens.length) return null;
    return tokens.slice(0, 3).join(' ');
  }, []);

  const onEvent = useCallback(
    async (e: StitchWebEvent) => {
      if (e.type !== 'click') return;
      if (e.text === 'group') {
        onClose();
        return;
      }
      if (e.tag === 'div' && e.text === '') {
        onClose();
        return;
      }
      if (e.text.includes('ثبّت التخمين')) {
        if (!selected) return;
        try {
          const res = await gameActions.makeGuess(selected);
          if (!res.correct) Alert.alert('خطأ', 'تخمين غلط! هتتخصم نقاط + يتفوت دورك الجاي.');
          onClose();
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
        return;
      }
      const g = extractGuess(e.text);
      if (g) setSelected(g);
    },
    [extractGuess, onClose, selected]
  );

  return <StitchHtmlScreen htmlModule={stitchUiHtml.guess_picker_bottom_sheet} onEvent={onEvent} injectedJavaScript={injected} />;
}
