import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function JoinRoomScreen({ onJoined, onBack }: { onJoined: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const profileName = useGameStore((s) => s.profile.name);
  const [code, setCode] = useState('');
  const serverUrl = useGameStore((s) => s.serverUrl);
  const error = useGameStore((s) => s.error);
  const inputRef = useRef<TextInput>(null);
  const modalInputRef = useRef<TextInput>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);

  useEffect(() => {
    if (!codeModalOpen) return;
    const t1 = setTimeout(() => modalInputRef.current?.focus(), 0);
    const t2 = setTimeout(() => modalInputRef.current?.focus(), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [codeModalOpen]);

  const injected = useMemo(() => {
    return `
(function () {
  function bySel(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
  }
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function toCode(raw) {
    return String(raw || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  }
  onReady(function () {
    var row = bySel('div[dir="ltr"]');
    if (!row) return;
    var boxes = Array.prototype.slice.call(row.children || []).filter(function (c) { return c && c.nodeType === 1; }).slice(0, 6);
    if (!boxes.length) return;

    function paint(val) {
      for (var i = 0; i < boxes.length; i++) {
        var ch = val[i] || '_';
        boxes[i].textContent = ch;
      }
    }

    try {
      row.setAttribute('data-stitch-tap', '1');
      row.setAttribute('data-stitch-action', 'focus_code');
      row.setAttribute('role', 'button');
      row.style.cursor = 'text';
    } catch (e) {}

    boxes.forEach(function (b) {
      b.setAttribute('data-stitch-tap', '1');
      b.setAttribute('data-stitch-action', 'focus_code');
      b.setAttribute('role', 'button');
      b.style.cursor = 'text';
    });

    try {
      var paste = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
        return ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '').indexOf('نسخ الكود من الحافظة') >= 0;
      });
      if (paste) paste.setAttribute('data-stitch-action', 'focus_code');
    } catch (e) {}

    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        paint(toCode(p.code || ''));
      } catch (e) {}
    };

    try {
      var back = document.querySelector('header span.material-symbols-outlined');
      if (back && (back.textContent || '').trim() === 'arrow_forward') {
        var btn = back.closest ? back.closest('button') : null;
        if (btn) btn.setAttribute('data-stitch-action', 'back');
      }
    } catch (e) {}

    try {
      var enter = Array.prototype.slice.call(document.querySelectorAll('button') || []).find(function (b) {
        return ((b.textContent || '').replace(/\\s+/g, ' ').trim() || '').indexOf('ادخل') >= 0;
      });
      if (enter) enter.setAttribute('data-stitch-action', 'enter_room');
    } catch (e) {}
  });
})();
true;
`;
  }, []);

  const onEvent = useCallback(
    async (e: StitchWebEvent) => {
      if (e.type === 'input') {
        if (e.id === 'join_code') setCode(String(e.value ?? ''));
        return;
      }
      if (e.type !== 'click') return;
      const action = String(e.action ?? '').trim();
      const txt = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      const icon = e.dataIcon ?? null;

      if (icon === 'home' || txt === 'home') {
        onBack();
        return;
      }

      if (action === 'back' || icon === 'arrow_forward' || txt === 'arrow_forward') {
        onBack();
        return;
      }

      if (action === 'focus_code') {
        setCodeModalOpen(true);
        return;
      }

      const isEnter = action === 'enter_room' || txt.includes('ادخل') || icon === 'sports_esports';
      if (!isEnter) return;
      const trimmed = code.trim().toUpperCase();
      if (!trimmed || loading) return;
      try {
        setLoading(true);
        await gameActions.joinRoom(trimmed, profileName);
        onJoined();
      } catch (err: any) {
        Alert.alert('خطأ', `${String(err?.message ?? err)}\n\nServer: ${serverUrl}${error ? `\n${error}` : ''}`);
      } finally {
        setLoading(false);
      }
    },
    [code, error, loading, onBack, onJoined, profileName, serverUrl]
  );

  return (
    <>
      <StitchHtmlScreen
        htmlModule={stitchUiHtml.join_room_screen}
        onEvent={onEvent}
        injectedJavaScript={injected}
        syncPayload={{ code }}
      />
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(t) => setCode(String(t ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6))}
        autoCapitalize="characters"
        autoCorrect={false}
        showSoftInputOnFocus
        keyboardType="default"
        returnKeyType="done"
        maxLength={6}
        style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 2, opacity: 0.01, zIndex: 99999, elevation: 99999 }}
      />

      <Modal transparent visible={codeModalOpen} animationType="fade" onRequestClose={() => setCodeModalOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 18 }}
          onPress={() => setCodeModalOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: '#0a0e16',
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,176,32,0.25)'
            }}
            onPress={() => modalInputRef.current?.focus()}
          >
            <Text style={{ color: '#FFB020', fontWeight: '900', fontSize: 16, textAlign: 'right' }}>ادخل كود الأوضة</Text>
            <View style={{ height: 10 }} />
            <TextInput
              ref={modalInputRef}
              value={code}
              onChangeText={(t) => setCode(String(t ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="done"
              maxLength={6}
              placeholder="مثال: A1B2C3"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: 'white',
                fontWeight: '900',
                fontSize: 20,
                textAlign: 'center',
                letterSpacing: 3
              }}
              onSubmitEditing={async () => {
                const trimmed = code.trim().toUpperCase();
                if (trimmed.length < 4) return;
                if (loading) return;
                try {
                  setLoading(true);
                  await gameActions.joinRoom(trimmed, profileName);
                  setCodeModalOpen(false);
                  onJoined();
                } catch (err: any) {
                  Alert.alert('خطأ', `${String(err?.message ?? err)}\n\nServer: ${serverUrl}${error ? `\n${error}` : ''}`);
                } finally {
                  setLoading(false);
                }
              }}
            />

            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
              <Pressable
                onPress={() => setCodeModalOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>إلغاء</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setCodeModalOpen(false);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#FFB020',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#0a0e16', fontWeight: '900' }}>تم</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
