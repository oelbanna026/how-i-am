import React, { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { StitchHtmlScreen, type StitchWebEvent } from '../components/StitchHtmlScreen';
import { gameActions, useGameStore } from '../gameStore';
import { stitchUiHtml } from '../stitchUiAssets';

export function GuessPickerScreen({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const serverUrl = useGameStore((s) => s.serverUrl);
  const offline = String(useGameStore((s) => s.currentRoom?.roomCode ?? '')) === 'OFFLINE';

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
  function byText(q, needle) {
    var els = Array.prototype.slice.call(document.querySelectorAll(q) || []);
    var n = norm(needle);
    return els.find(function (e) { return norm(e.textContent) === n; }) || null;
  }
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function catTitle(cat) {
    if (cat === 'fruit') return 'فواكه';
    if (cat === 'vegetable') return 'خضار';
    if (cat === 'animal') return 'حيوانات';
    if (cat === 'object') return 'أشياء';
    if (cat === 'food') return 'أكل';
    return 'أخرى';
  }
  function catColor(cat) {
    if (cat === 'fruit') return 'bg-primary';
    if (cat === 'vegetable') return 'bg-secondary-fixed';
    if (cat === 'animal') return 'bg-tertiary';
    if (cat === 'object') return 'bg-outline';
    if (cat === 'food') return 'bg-primary-container';
    return 'bg-outline-variant';
  }
  function buildList(cards) {
    var scroll = document.querySelector('div.flex-1.overflow-y-auto.space-y-8');
    if (!scroll) return;
    var groups = {};
    (cards || []).forEach(function (c) {
      var cat = String(c.category || '').toLowerCase();
      if (!cat) cat = 'other';
      groups[cat] = groups[cat] || [];
      groups[cat].push(c);
    });
    var order = ['fruit', 'vegetable', 'animal', 'object', 'food', 'other'];
    var html = '';
    order.forEach(function (cat) {
      var list = groups[cat] || [];
      if (!list.length) return;
      html += '<section>';
      html += '<div class="flex items-center gap-3 mb-4 sticky top-0 bg-transparent py-2 z-10 backdrop-blur-md">';
      html += '<div class="w-1.5 h-6 ' + catColor(cat) + ' rounded-full shadow-[0_0_12px_rgba(46,238,156,0.35)]"></div>';
      html += '<h3 class="font-bold text-lg text-on-surface">' + escapeHtml(catTitle(cat)) + '</h3>';
      html += '</div>';
      html += '<div class="grid grid-cols-1 gap-3">';
      list.forEach(function (c) {
        var name = escapeHtml(String(c.name || ''));
        var uri = escapeHtml(String(c.imageUri || ''));
        html += '<button data-stitch-tap="1" class="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface-container/50 hover:bg-primary-container/10 border border-white/5 transition-all group active:scale-95">';
        html += '<div class="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-white/10 group-hover:ring-primary/50 transition-all">';
        html += uri ? '<img class="w-full h-full object-cover" src="' + uri + '"/>' : '<div class="w-full h-full bg-white/10"></div>';
        html += '</div>';
        html += '<div class="flex-1 text-right">';
        html += '<p class="font-bold text-on-surface">' + name + '</p>';
        html += '<p class="text-xs text-outline">' + escapeHtml(catTitle(String(c.category || '').toLowerCase())) + '</p>';
        html += '</div>';
        html += '</button>';
      });
      html += '</div>';
      html += '</section>';
    });
    scroll.innerHTML = html || '<div class="text-center text-outline py-10">لا يوجد كروت</div>';

    var q = '';
    try { q = norm((document.querySelector('input[type="text"]') || {}).value || ''); } catch (e) {}
    if (q) applyFilter(q);
  }
  function applyFilter(query) {
    var q = norm(query).toLowerCase();
    var scroll = document.querySelector('div.flex-1.overflow-y-auto.space-y-8');
    if (!scroll) return;
    var items = Array.prototype.slice.call(scroll.querySelectorAll('button[data-stitch-tap]') || []);
    items.forEach(function (btn) {
      var t = norm(btn.textContent).toLowerCase();
      btn.style.display = q && t.indexOf(q) < 0 ? 'none' : '';
    });
  }
  onReady(function () {
    try {
    window.__RN_SYNC = function (payload) {
      try {
        var p = payload || {};
        var serverUrl = String(p.serverUrl || '').replace(/\\/+$/, '');
        var offline = Boolean(p.offline);

        try {
          var search = document.querySelector('input[type="text"]');
          if (search) search.setAttribute('placeholder', 'ابحث عن كارت...');
        } catch (e) {}

        try {
          var recentLabel = byText('p', 'عمليات بحث أخيرة');
          if (recentLabel && recentLabel.parentElement) recentLabel.parentElement.style.display = 'none';
        } catch (e) {}

        if (offline) {
          var scroll = document.querySelector('div.flex-1.overflow-y-auto.space-y-8');
          if (scroll) scroll.innerHTML = '<div class="text-center text-outline py-10">الأوفلاين: افتح التخمين من الأونلاين لعرض الصور</div>';
          return;
        }

        if (!serverUrl) return;
        var scroll2 = document.querySelector('div.flex-1.overflow-y-auto.space-y-8');
        if (scroll2) scroll2.innerHTML = '<div class="text-center text-outline py-10">جاري تحميل الكروت…</div>';
        fetch(serverUrl + '/cards')
          .then(function (r) { return r.json(); })
          .then(function (json) {
            var cards = (json && json.cards) ? json.cards : [];
            cards = (cards || [])
              .filter(function (c) { return String(c && c.category || '').toLowerCase() !== 'character'; })
              .map(function (c) {
                return {
                  name: String(c.name || ''),
                  category: String(c.category || '').toLowerCase(),
                  imageUri: (function () {
                    var p = String(c.imagePath || '').trim();
                    if (!p) return '';
                    if (p.indexOf('http://') === 0 || p.indexOf('https://') === 0) return p;
                    return serverUrl + (p.indexOf('/') === 0 ? '' : '/') + p;
                  })()
                };
              });
            cards.sort(function (a, b) {
              if (a.category !== b.category) return a.category < b.category ? -1 : 1;
              return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
            });
            buildList(cards);
          })
          .catch(function () {
            var scroll3 = document.querySelector('div.flex-1.overflow-y-auto.space-y-8');
            if (scroll3) scroll3.innerHTML = '<div class="text-center text-outline py-10">فشل تحميل الكروت</div>';
          });
      } catch (e) {}
    };

      var overlay = document.querySelector('div.fixed.inset-0.bg-black\\/60');
      if (overlay && overlay.setAttribute) overlay.setAttribute('data-stitch-tap', '1');
    } catch (e) {}
  });

    try {
      var search = document.querySelector('input[type="text"]');
      if (search) {
        search.addEventListener('input', function () {
          try { applyFilter(search.value || ''); } catch (e) {}
        });
      }
    } catch (e) {}
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

  return (
    <StitchHtmlScreen
      htmlModule={stitchUiHtml.guess_picker_bottom_sheet}
      onEvent={onEvent}
      injectedJavaScript={injected}
      syncPayload={{ serverUrl, offline }}
    />
  );
}
