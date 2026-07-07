/* ============================================================================
 * Ocarina of Time — compose studio: record / save / share your own melodies,
 * plus the 8-note Scarecrow's Song that free play then recognises.
 * ==========================================================================*/
(function () {
  'use strict';
  if (!window.OOT || !OOT.api) return;
  const { api, NOTES } = OOT;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LS_COMPS = 'oot-comps', LS_SCARE = 'oot-scarecrow';
  const MAX_NOTES = 32;

  let comps = [];
  try { comps = JSON.parse(localStorage.getItem(LS_COMPS) || '[]'); } catch (e) { /* ignore */ }
  const saveComps = () => { try { localStorage.setItem(LS_COMPS, JSON.stringify(comps)); } catch (e) { /* ignore */ } };

  /* -------------------------------------------------------------- Recorder */
  const recBtn = $('#rec-btn'), recStop = $('#rec-stop'), recPrev = $('#rec-preview');
  const recSave = $('#rec-save'), recName = $('#rec-name'), recStatus = $('#rec-status'), recTake = $('#rec-take');

  let recording = false;
  let take = [];               // [{id, t, d}] as-played
  const open = {};             // id -> take entry currently held

  // Quantize a held duration to a note value the staff can draw.
  // Recording reference: ♩ = 120 (one beat = 500 ms).
  function quantBeats(ms) {
    const b = ms / 500;
    return [0.5, 1, 1.5, 2, 3].reduce((best, c) => Math.abs(c - b) < Math.abs(best - b) ? c : best, 0.5);
  }

  function takeToSong(name) {
    return {
      id: 'c' + Date.now(),
      name: name || `내 노래 ${comps.length + 1}`,
      bpm: 120,
      notes: take.map((n) => [n.id, quantBeats(n.d || 400)]),
      created: Date.now(),
    };
  }

  function renderTake(el, ids) {
    el.innerHTML = ids.map((id) =>
      `<span style="color:${NOTES[id].color}">${NOTES[id].arrow}</span>`).join('');
  }

  function stopRec(msg) {
    recording = false;
    if (recBtn) recBtn.disabled = false;
    if (recStop) recStop.disabled = true;
    const has = take.length > 0;
    if (recPrev) recPrev.disabled = !has;
    if (recSave) recSave.disabled = !has;
    if (recStatus) recStatus.textContent = msg ||
      (has ? `■ ${take.length}음 녹음됨 — 미리듣기 후 저장하세요.` : '녹음된 음이 없습니다. 다시 시도해 보세요.');
  }

  if (recBtn) recBtn.addEventListener('click', () => {
    api.stopAll();
    scRecording = false;                       // one recorder at a time
    recording = true;
    take = [];
    renderTake(recTake, []);
    recBtn.disabled = true;
    recStop.disabled = false;
    recPrev.disabled = true;
    recSave.disabled = true;
    recStatus.textContent = '● 녹음 중… 오카리나를 연주하세요 (최대 32음)';
  });
  if (recStop) recStop.addEventListener('click', () => stopRec());
  if (recPrev) recPrev.addEventListener('click', () => {
    if (take.length) api.playSong(takeToSong('preview'), null);
  });
  if (recSave) recSave.addEventListener('click', () => {
    if (!take.length) return;
    comps.push(takeToSong(recName.value.trim()));
    saveComps();
    take = [];
    renderTake(recTake, []);
    recName.value = '';
    recPrev.disabled = true;
    recSave.disabled = true;
    recStatus.textContent = '💾 저장되었습니다! 아래 "내 노래"에서 연주할 수 있어요.';
    renderComps();
    if (OOT.progress) OOT.progress.event('comp', { count: comps.length });
  });

  /* ------------------------------------------------------ Scarecrow's Song */
  const scBtn = $('#scare-btn'), scClear = $('#scare-clear'), scStatus = $('#scare-status');
  let scRecording = false;
  let scTake = [];
  let scare = null;
  try { scare = JSON.parse(localStorage.getItem(LS_SCARE) || 'null'); } catch (e) { /* ignore */ }

  function applyScare() {
    const ok = Array.isArray(scare) && scare.length === 8 && scare.every((id) => NOTES[id]);
    api.setScarecrow(ok ? scare : null);
    if (scClear) scClear.hidden = !ok;
    if (scStatus) {
      if (ok) {
        renderTake(scStatus, scare);
        scStatus.insertAdjacentHTML('beforeend', '<em class="sc-ok"> ✔ 등록됨 — 자유 연주로 쳐보세요!</em>');
      } else {
        scStatus.innerHTML = '<em class="sc-none">아직 등록된 곡이 없습니다.</em>';
      }
    }
  }

  if (scBtn) scBtn.addEventListener('click', () => {
    api.stopAll();
    recording = false;                         // one recorder at a time
    scRecording = true;
    scTake = [];
    if (scStatus) scStatus.innerHTML = '<em>● 정확히 8음을 연주하세요…</em>';
  });
  if (scClear) scClear.addEventListener('click', () => {
    scare = null;
    try { localStorage.removeItem(LS_SCARE); } catch (e) { /* ignore */ }
    applyScare();
  });

  /* ------------------------------------------------------ Note capture bus */
  api.onNote((id) => {
    if (recording) {
      if (take.length >= MAX_NOTES) { stopRec(`■ 최대 ${MAX_NOTES}음까지 녹음됩니다 — 자동으로 정지했어요.`); return; }
      const n = { id, t: performance.now(), d: 0 };
      take.push(n);
      open[id] = n;
      renderTake(recTake, take.map((x) => x.id));
    } else if (scRecording) {
      scTake.push(id);
      renderTake(scStatus, scTake);
      if (scTake.length === 8) {
        scRecording = false;
        scare = scTake.slice();
        try { localStorage.setItem(LS_SCARE, JSON.stringify(scare)); } catch (e) { /* ignore */ }
        applyScare();
        if (OOT.progress) OOT.progress.event('scare');
      }
    }
  });
  api.onNoteEnd((id) => {
    const n = open[id];
    if (n) { n.d = performance.now() - n.t; open[id] = null; }
  });

  /* ------------------------------------------------------------ My songs */
  const list = $('#comp-list'), countEl = $('#comp-count');

  function shareLink(song) {
    const payload = { n: song.name, s: song.notes };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    return location.href.split('#')[0] + '#song=' + code;
  }

  function renderComps() {
    if (!list) return;
    if (countEl) countEl.textContent = comps.length ? `${comps.length}곡` : '';
    if (!comps.length) {
      list.innerHTML = '<p class="comp-empty">아직 저장한 노래가 없습니다 — 위에서 녹음해 보세요! 🎶</p>';
      return;
    }
    list.innerHTML = '';
    comps.forEach((song, idx) => {
      const card = document.createElement('article');
      card.className = 'song-card comp';
      card.dataset.song = song.id;
      card.innerHTML =
        `<header><div class="title"><h3 class="c-name">${esc(song.name)}</h3>` +
        `<span class="ko">나의 작곡 · ${song.notes.length}음</span></div>` +
        `<span class="bpm">♩=${song.bpm}</span></header>` +
        `<div class="tabs">${api.tabHTML(song)}</div>` +
        api.staffSVG(song) +
        `<div class="actions">` +
        `<button class="play-btn">▶ Play</button>` +
        `<button class="mini-btn share-btn" title="공유 링크 복사">🔗</button>` +
        `<button class="mini-btn del-btn" title="삭제">🗑</button>` +
        `</div>`;
      $('.play-btn', card).addEventListener('click', () => {
        const playing = card.classList.contains('playing') && api.isPlaying();
        if (playing) api.stopAll();
        else api.playSong(song, card);
      });
      $('.share-btn', card).addEventListener('click', () => {
        const url = shareLink(song);
        const done = () => { recStatus.textContent = '🔗 공유 링크를 복사했습니다 — 붙여넣어 전달하세요!'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, () => window.prompt('이 링크를 복사하세요:', url));
        } else {
          window.prompt('이 링크를 복사하세요:', url);
        }
      });
      $('.del-btn', card).addEventListener('click', () => {
        if (!window.confirm(`"${song.name}" 을(를) 삭제할까요?`)) return;
        comps.splice(idx, 1);
        saveComps();
        renderComps();
      });
      list.appendChild(card);
    });
  }

  /* ----------------------------------------------- Import from share link */
  (function importFromHash() {
    const m = location.hash.match(/#song=([A-Za-z0-9+/=]+)/);
    if (!m) return;
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if (o && Array.isArray(o.s)) {
        const notes = o.s.filter((x) => Array.isArray(x) && NOTES[x[0]]).slice(0, MAX_NOTES)
          .map(([id, b]) => [id, [0.5, 1, 1.5, 2, 3].includes(b) ? b : 1]);
        if (notes.length) {
          comps.push({ id: 'c' + Date.now(), name: String(o.n || '공유된 노래').slice(0, 24) + ' ✦', bpm: 120, notes, created: Date.now() });
          saveComps();
          if (OOT.progress) OOT.progress.event('comp', { count: comps.length });
        }
      }
    } catch (e) { /* bad link — ignore */ }
    history.replaceState(null, '', location.pathname + location.search);
  })();

  applyScare();
  renderComps();
})();
