import React, { useEffect } from 'react';
import { StitchHtmlScreen } from '../components/StitchHtmlScreen';
import { stitchUiHtml } from '../stitchUiAssets';

const SPLASH_MS = 2600;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(), SPLASH_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.splash_loading_screen}
      injectedJavaScript={`
(function () {
  function addStyle(css) {
    try {
      var style = document.getElementById('rn-splash-anim');
      if (!style) {
        style = document.createElement('style');
        style.id = 'rn-splash-anim';
        document.head.appendChild(style);
      }
      style.textContent = css;
    } catch (e) {}
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(function () {
    addStyle(
      [
        '@keyframes rnFadeUp {',
        '  0% { opacity: 0; transform: translate3d(0, 14px, 0); }',
        '  100% { opacity: 1; transform: translate3d(0, 0, 0); }',
        '}',
        '@keyframes rnDot {',
        '  0%, 100% { transform: scale(1); opacity: 0.35; }',
        '  50% { transform: scale(1.35); opacity: 1; }',
        '}',
        '@keyframes rnFloatA {',
        '  0%, 100% { transform: translate3d(0, 0, 0); }',
        '  50% { transform: translate3d(14px, -18px, 0); }',
        '}',
        '@keyframes rnFloatB {',
        '  0%, 100% { transform: translate3d(0, 0, 0); }',
        '  50% { transform: translate3d(-10px, 16px, 0); }',
        '}',
        'main { animation: rnFadeUp 600ms ease-out both; }',
        'h1 { animation: rnFadeUp 700ms ease-out both; }',
        'p { animation: rnFadeUp 800ms ease-out both; }',
        'div.fixed.inset-0 > div:nth-child(1) { animation: rnFloatA 4.5s ease-in-out infinite; }',
        'div.fixed.inset-0 > div:nth-child(2) { animation: rnFloatB 6.5s ease-in-out infinite; }',
        'div.fixed.inset-0 > div:nth-child(3) { animation: rnFloatA 5.5s ease-in-out infinite; }',
        'div.flex.space-x-reverse.space-x-3 > div { animation: rnDot 900ms ease-in-out infinite; }',
        'div.flex.space-x-reverse.space-x-3 > div:nth-child(1) { animation-delay: 0ms; }',
        'div.flex.space-x-reverse.space-x-3 > div:nth-child(2) { animation-delay: 150ms; }',
        'div.flex.space-x-reverse.space-x-3 > div:nth-child(3) { animation-delay: 300ms; }'
      ].join('\\n')
    );
  });
})();
true;
      `}
    />
  );
}
