import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import { audioService } from '../audio/audioService';

export type StitchWebEvent =
  | {
      type: 'click';
      text: string;
      tag: string;
      href: string | null;
      dataIcon: string | null;
      action?: string | null;
      id?: string | null;
    }
  | {
      type: 'input';
      value: string;
      id: string | null;
      name: string | null;
      placeholder: string | null;
      contentEditable?: boolean;
      source?: string | null;
    };

type Props = {
  htmlModule: number;
  onEvent?: (event: StitchWebEvent) => void;
  injectedJavaScript?: string;
  backgroundColor?: string;
  syncPayload?: any;
};

function buildBridgeScript(extra?: string) {
  const base = `
(function () {
  function post(msg) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    } catch (e) {}
  }

  function pickDataIcon(el) {
    if (!el) return null;
    var own = el.getAttribute && el.getAttribute('data-icon');
    if (own) return own;
    var child = el.querySelector && el.querySelector('[data-icon]');
    if (child && child.getAttribute) return child.getAttribute('data-icon');
    return null;
  }

  function pickText(el) {
    if (!el) return '';
    var t = (el.innerText || el.textContent || '').trim();
    return t;
  }

  function handleClickTarget(target) {
    try {
      if (!target) return;
      var el = target.closest ? target.closest('button, a, [role="button"], [data-stitch-tap="1"], [data-icon]') : null;
      if (!el) return;
      var tag = (el.tagName || '').toLowerCase();
      var href = tag === 'a' ? (el.getAttribute ? el.getAttribute('href') : null) : null;
      var a = el.closest ? el.closest('a') : null;
      if (tag === 'a' || a) {
        try { if (a && a.getAttribute && a.getAttribute('href') === '#') {} } catch (e) {}
      }
      var action = el.getAttribute ? el.getAttribute('data-stitch-action') : null;
      var id = el.id ? String(el.id) : null;
      post({ type: 'click', text: pickText(el), tag: tag, href: href, dataIcon: pickDataIcon(el), action: action, id: id });
    } catch (err) {}
  }

  document.addEventListener(
    'click',
    function (e) {
      try {
        var target = e.target;
        if (!target) return;
        var a = target.closest ? target.closest('a') : null;
        if (a && a.getAttribute && a.getAttribute('href') === '#') e.preventDefault();
        handleClickTarget(target);
      } catch (err) {}
    },
    true
  );

  document.addEventListener(
    'input',
    function (e) {
      try {
        var t = e.target;
        if (!t) return;
        var tag = (t.tagName || '').toLowerCase();
        var isEditable = Boolean(t.isContentEditable);
        if (tag !== 'input' && tag !== 'textarea' && !isEditable) return;
        var value = '';
        if (tag === 'input' || tag === 'textarea') value = String(t.value || '');
        else value = String((t.innerText || t.textContent || '').trim());
        post({
          type: 'input',
          value: value,
          id: t.id ? String(t.id) : null,
          name: t.name ? String(t.name) : null,
          placeholder: t.placeholder ? String(t.placeholder) : null,
          contentEditable: isEditable
        });
      } catch (err) {}
    },
    true
  );

  document.addEventListener(
    'change',
    function (e) {
      try {
        var t = e.target;
        if (!t) return;
        var tag = (t.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
        var value = '';
        if (tag === 'select') value = String(t.value || '');
        else if (t.type === 'checkbox') value = String(Boolean(t.checked));
        else value = String(t.value || '');
        post({
          type: 'input',
          value: value,
          id: t.id ? String(t.id) : null,
          name: t.name ? String(t.name) : null,
          placeholder: t.placeholder ? String(t.placeholder) : null,
          contentEditable: false
        });
      } catch (err) {}
    },
    true
  );
})();
true;
`;
  const viewportFix = `
(function () {
  try {
    var vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
      vp = document.createElement('meta');
      vp.setAttribute('name', 'viewport');
      document.head.appendChild(vp);
    }
    vp.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  } catch (e) {}
})();
true;
`;
  const motionCss = `
(function () {
  try {
    var style = document.getElementById('rn-global-motion');
    if (!style) {
      style = document.createElement('style');
      style.id = 'rn-global-motion';
      document.head.appendChild(style);
    }
    style.textContent = [
      ':root{ -webkit-tap-highlight-color: transparent; }',
      'html,body{ height:100%; }',
      '@keyframes rnFadeIn{ from{ opacity:0; } to{ opacity:1; } }',
      '@keyframes rnRise{ from{ opacity:0; transform: translate3d(0,10px,0);} to{ opacity:1; transform: translate3d(0,0,0);} }',
      'body{ animation: rnFadeIn 220ms ease-out both; }',
      'header{ animation: rnRise 260ms ease-out both; }',
      'main{ animation: rnRise 360ms cubic-bezier(.2,.9,.2,1) both; }',
      '@media (prefers-reduced-motion: reduce){ body,header,main{ animation:none !important; } }'
    ].join('\\n');
  } catch (e) {}
})();
true;
`;
  return base + '\n' + viewportFix + '\n' + motionCss + '\n' + String(extra ?? '');
}

async function loadHtmlFromModule(htmlModule: number) {
  const asset = Asset.fromModule(htmlModule);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('MISSING_ASSET_URI');
  if (uri.startsWith('file:')) {
    return FileSystem.readAsStringAsync(uri);
  }
  const res = await fetch(uri);
  return res.text();
}

export function StitchHtmlScreen({
  htmlModule,
  onEvent,
  injectedJavaScript,
  backgroundColor,
  syncPayload
}: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const webRef = useRef<WebView>(null);
  const lastClickTs = useRef(0);

  const bridge = useMemo(() => buildBridgeScript(injectedJavaScript), [injectedJavaScript]);

  useEffect(() => {
    let mounted = true;
    setHtml(null);
    setLoaded(false);
    setFatal(null);
    loadHtmlFromModule(htmlModule)
      .then((t) => {
        if (!mounted) return;
        setHtml(t);
      })
      .catch((e) => {
        if (!mounted) return;
        setFatal(String(e?.message ?? e));
      });
    return () => {
      mounted = false;
    };
  }, [htmlModule]);

  useEffect(() => {
    if (!loaded) return;
    if (syncPayload === undefined) return;
    const json = JSON.stringify(syncPayload ?? null).replace(/</g, '\\u003c');
    webRef.current?.injectJavaScript(
      `try{window.__RN_SYNC&&window.__RN_SYNC(${json});}catch(e){};true;`
    );
  }, [loaded, syncPayload]);

  if (fatal) {
    return (
      <View style={{ flex: 1, backgroundColor: backgroundColor ?? '#0a0e16', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
        <Text style={{ color: '#eef0fc', fontWeight: '800', marginBottom: 8 }}>UI failed to load</Text>
        <Text style={{ color: '#a8abb6', textAlign: 'center' }}>{fatal}</Text>
      </View>
    );
  }

  if (!html) {
    return (
      <View style={{ flex: 1, backgroundColor: backgroundColor ?? '#0a0e16', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html }}
      scalesPageToFit={false}
      bounces={false}
      setBuiltInZoomControls={false}
      setDisplayZoomControls={false}
      onShouldStartLoadWithRequest={(req) => {
        const url = String(req?.url ?? '');
        if (!url) return false;
        if (url === 'about:blank') return true;
        if (url.startsWith('about:blank#')) return false;
        if (url.startsWith('http://') || url.startsWith('https://')) return true;
        if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return true;
        return true;
      }}
      onMessage={(e) => {
        const raw = e.nativeEvent.data;
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed?.type) return;
          if (parsed.type === 'click') {
            const now = Date.now();
            if (now - lastClickTs.current > 60) {
              lastClickTs.current = now;
              const tag = String(parsed.tag ?? '').toLowerCase();
              const hasAction = Boolean(String(parsed.action ?? '').trim());
              const hasIcon = Boolean(String(parsed.dataIcon ?? '').trim());
              if (tag === 'button' || hasAction || hasIcon) void audioService.playSFX('click');
            }
          }
          onEvent?.(parsed as StitchWebEvent);
        } catch {}
      }}
      injectedJavaScriptBeforeContentLoaded={bridge}
      onLoadEnd={() => setLoaded(true)}
      onError={(e) => setFatal(String(e?.nativeEvent?.description ?? 'WEBVIEW_ERROR'))}
      onHttpError={(e) => setFatal(String(e?.nativeEvent?.statusCode ?? 'HTTP_ERROR'))}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
      style={{ flex: 1, backgroundColor: backgroundColor ?? '#0a0e16' }}
    />
  );
}
