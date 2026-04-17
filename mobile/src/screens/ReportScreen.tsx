import React, { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { gameActions, useGameStore } from '../gameStore';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { stitchUiHtml } from '../stitchUiAssets';

export function ReportScreen({ onBack }: { onBack: () => void }) {
  const players = useGameStore((s) => s.players);
  const myId = useGameStore((s) => s.userId);
  const reportTarget = useGameStore((s) => s.reportTargetUserId);
  const [reason, setReason] = useState('محتوى غير لائق');

  const list = useMemo(() => players.filter((p: any) => p.id !== myId), [players, myId]);
  const targetId = useMemo(() => {
    if (reportTarget) return String(reportTarget);
    return list[0]?.id ? String(list[0].id) : null;
  }, [list, reportTarget]);

  const targetName = useMemo(() => {
    const id = String(targetId ?? '');
    const p = id ? list.find((x: any) => String(x?.id ?? '') === id) : null;
    return String(p?.name ?? '—');
  }, [list, targetId]);

  const injected = useMemo(() => {
    return `
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(function () {
    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var h2 = document.querySelector('main h2');
        if (h2 && typeof p.targetName === 'string') h2.textContent = p.targetName;
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
      const t = String(e.text ?? '').replace(/\s+/g, ' ').trim();
      if (t === 'group') {
        onBack();
        return;
      }
      if (t.includes('إلغاء')) {
        onBack();
        return;
      }
      if (t.includes('رسائل مزعجة')) setReason('رسائل مزعجة (Spam)');
      if (t.includes('محتوى غير لائق')) setReason('محتوى غير لائق');
      if (t.includes('سلوك عدواني')) setReason('سلوك عدواني أو تنمر');
      if (t.includes('انتحال شخصية')) setReason('انتحال شخصية');
      if (t.includes('أسباب أخرى')) setReason('أسباب أخرى');

      if (t.includes('تأكيد الإبلاغ والحظر')) {
        if (!targetId) {
          Alert.alert('خطأ', 'لا يوجد لاعب للإبلاغ');
          return;
        }
        try {
          await gameActions.reportPlayer({ reportedUserId: targetId, reason: reason.trim() });
          await gameActions.blockUser(targetId);
          gameActions.setReportTargetUserId(null);
          onBack();
        } catch (err: any) {
          Alert.alert('خطأ', String(err?.message ?? err));
        }
      }
    },
    [onBack, reason, targetId]
  );

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.report_block_screen}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ targetName }}
    />
  );
}
