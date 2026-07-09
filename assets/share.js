/*
 * Ocarina of Time — share the app.
 * Uses the native share sheet on devices that support it (phones/tablets),
 * and falls back to copying the link to the clipboard on desktop.
 * The Open Graph banner (index.html <head>) becomes the preview image
 * automatically once the shared link is pasted into a messenger.
 */
(function () {
  'use strict';

  var btn = document.getElementById('share-btn');
  if (!btn) return;

  var toastBox = document.getElementById('ach-toast');

  // Reuse the achievement-toast box + animation for a quiet confirmation.
  function toast(icon, msg) {
    if (!toastBox) { window.alert(msg); return; }
    var el = document.createElement('div');
    el.className = 'ach-pop';
    el.innerHTML = '<span class="a-icon">' + icon + '</span><span>' + msg + '</span>';
    toastBox.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2600);
    setTimeout(function () { el.remove(); }, 3100);
  }

  function shareData() {
    return {
      title: 'Ocarina of Time — 시간의 오카리나',
      text: '하이랄의 명곡을 브라우저에서 직접 연주해보세요 🎵 젤다 오카리나 웹앱',
      // Strip any #song=... fragment so we always share the clean app URL.
      url: location.href.split('#')[0]
    };
  }

  function copyFallback(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { toast('🔗', '링크를 복사했어요 — 붙여넣어 공유하세요!'); },
        function () { window.prompt('이 링크를 복사하세요:', url); }
      );
    } else {
      window.prompt('이 링크를 복사하세요:', url);
    }
  }

  btn.addEventListener('click', function () {
    var data = shareData();
    if (navigator.share) {
      navigator.share(data).catch(function (err) {
        // AbortError = the user simply closed the share sheet; stay silent.
        if (!err || err.name !== 'AbortError') copyFallback(data.url);
      });
      return;
    }
    copyFallback(data.url);
  });
})();
