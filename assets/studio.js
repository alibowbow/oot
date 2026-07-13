/* ============================================================================
 * Ocarina of Time — compose studio
 * Record, generate, import, save, and URL-hash-share five-note melodies.
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
  const VALID_BEATS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  const SCALE = ['A', 'down', 'right', 'left', 'up'];
  const ORIGIN_LABEL = {
    recorded: '직접 작곡',
    random: '랜덤 생성',
    external: '외부곡',
    shared: '공유받은 곡',
  };
  const ORIGIN_CODE = { recorded: 'd', random: 'r', external: 'e', shared: 's' };
  const CODE_ORIGIN = { d: 'recorded', r: 'random', e: 'external', s: 'shared' };

  const NOTE_ALIASES = {
    a: 'A', 'd4': 'A', '레4': 'A', '낮은레': 'A',
    down: 'down', '▼': 'down', '아래': 'down', 'f4': 'down', '파': 'down',
    right: 'right', '▶': 'right', '오른쪽': 'right', 'a4': 'right', '라': 'right',
    left: 'left', '◀': 'left', '왼쪽': 'left', 'b4': 'left', '시': 'left',
    up: 'up', '▲': 'up', '위': 'up', 'd5': 'up', '레5': 'up', '높은레': 'up',
  };

  const idNow = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clampBpm = (value) => Math.max(50, Math.min(220, Math.round(Number(value) || 120)));
  const closestBeat = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return VALID_BEATS.reduce((best, beat) =>
      Math.abs(beat - n) < Math.abs(best - n) ? beat : best, 1);
  };

  function noteId(value) {
    const raw = String(value == null ? '' : value).trim();
    if (NOTES[raw]) return raw;
    return NOTE_ALIASES[raw.toLowerCase()] || NOTE_ALIASES[raw] || null;
  }

  function normalizeNotes(raw, strict) {
    if (!Array.isArray(raw)) return [];
    const notes = [];
    for (const entry of raw) {
      const pair = Array.isArray(entry) ? entry : [entry, 1];
      const id = noteId(pair[0]);
      if (!id) {
        if (strict) throw new Error(`알 수 없는 음표 “${String(pair[0])}”`);
        continue;
      }
      notes.push([id, closestBeat(pair[1])]);
      if (notes.length === MAX_NOTES) break;
    }
    return notes;
  }

  function normalizeSong(raw, defaults) {
    const fallback = defaults || {};
    const notes = normalizeNotes(raw && (raw.notes || raw.s), !!fallback.strict);
    if (!notes.length) return null;
    const origin = ORIGIN_LABEL[raw.origin] ? raw.origin
      : CODE_ORIGIN[raw.o] || fallback.origin || 'recorded';
    return {
      id: raw.id || idNow(),
      name: String(raw.name || raw.n || fallback.name || '이름 없는 곡').trim().slice(0, 24) || '이름 없는 곡',
      bpm: clampBpm(raw.bpm || raw.b || fallback.bpm),
      notes,
      origin,
      shared: !!(raw.shared || fallback.shared),
      created: Number(raw.created) || Date.now(),
    };
  }

  let comps = [];
  try {
    const stored = JSON.parse(localStorage.getItem(LS_COMPS) || '[]');
    if (Array.isArray(stored)) comps = stored.map((song) => normalizeSong(song)).filter(Boolean);
  } catch (e) { /* ignore malformed local data */ }

  const saveComps = () => {
    try { localStorage.setItem(LS_COMPS, JSON.stringify(comps)); } catch (e) { /* private mode / quota */ }
  };

  function sameSong(a, b) {
    return a.name === b.name && a.bpm === b.bpm && JSON.stringify(a.notes) === JSON.stringify(b.notes);
  }

  function addSong(raw, options) {
    const song = normalizeSong(raw, options);
    if (!song) throw new Error('연주 가능한 음표가 없습니다.');
    const duplicate = comps.find((item) => sameSong(item, song));
    if (duplicate) return { song: duplicate, added: false };
    comps.push(song);
    saveComps();
    renderComps();
    if (OOT.progress) OOT.progress.event('comp', { count: comps.length });
    return { song, added: true };
  }

  /* ------------------------------------------------------ Share hash codec */
  function utf8ToBinary(text) {
    if (window.TextEncoder) {
      const bytes = new TextEncoder().encode(text);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      return binary;
    }
    return unescape(encodeURIComponent(text));
  }

  function binaryToUtf8(binary) {
    if (window.TextDecoder) {
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(binary));
  }

  function encodeSong(song) {
    const payload = {
      v: 2,
      n: song.name,
      b: clampBpm(song.bpm),
      o: ORIGIN_CODE[song.origin] || 'd',
      s: normalizeNotes(song.notes),
    };
    return btoa(utf8ToBinary(JSON.stringify(payload)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodeSongCode(value) {
    let code = decodeURIComponent(String(value || '')).replace(/-/g, '+').replace(/_/g, '/');
    code += '='.repeat((4 - code.length % 4) % 4);
    const payload = JSON.parse(binaryToUtf8(atob(code)));
    return normalizeSong(payload, { origin: 'shared', shared: true, strict: true });
  }

  function codeFromHash(value) {
    const text = String(value || '');
    const hash = text.includes('#') ? text.slice(text.indexOf('#')) : text;
    const match = hash.match(/(?:^#|[&#])song=([^&]+)/);
    return match ? match[1] : null;
  }

  function songFromHash(value) {
    const code = codeFromHash(value);
    if (!code) return null;
    return decodeSongCode(code);
  }

  function shareLink(song) {
    return location.href.split('#')[0] + '#song=' + encodeSong(song);
  }

  /* -------------------------------------------------------------- Recorder */
  const recBtn = $('#rec-btn'), recStop = $('#rec-stop'), recPrev = $('#rec-preview');
  const recSave = $('#rec-save'), recName = $('#rec-name'), recStatus = $('#rec-status'), recTake = $('#rec-take');

  let recording = false;
  let take = [];               // [{id, t, d, beats?}]
  let takeMeta = { bpm: 120, origin: 'recorded', name: '' };
  const open = {};             // id -> take entry currently held

  // Recording reference: quarter note = 500 ms (♩ = 120).
  function quantBeats(ms) {
    const beats = Number(ms) / 500;
    return [0.5, 1, 1.5, 2, 3].reduce((best, value) =>
      Math.abs(value - beats) < Math.abs(best - beats) ? value : best, 0.5);
  }

  function takeToSong(name) {
    return normalizeSong({
      id: idNow(),
      name: name || takeMeta.name || `내 노래 ${comps.length + 1}`,
      bpm: takeMeta.bpm,
      origin: takeMeta.origin,
      notes: take.map((note) => [note.id, note.beats || quantBeats(note.d || 400)]),
      created: Date.now(),
    });
  }

  function renderTake(el, values) {
    if (!el) return;
    el.innerHTML = (values || []).map((value) => {
      const id = Array.isArray(value) ? value[0] : (value && value.id) || value;
      return NOTES[id] ? `<span style="color:${NOTES[id].color}">${NOTES[id].arrow}</span>` : '';
    }).join('');
  }

  function setDraft(raw, message, autoplay) {
    const song = normalizeSong(raw, { strict: true });
    if (!song) throw new Error('연주 가능한 음표가 없습니다.');
    api.stopAll();
    recording = false;
    scRecording = false;
    takeMeta = { bpm: song.bpm, origin: song.origin, name: song.name };
    take = song.notes.map(([id, beats]) => ({ id, t: 0, d: beats * 60000 / song.bpm, beats }));
    if (recBtn) recBtn.disabled = false;
    if (recStop) recStop.disabled = true;
    if (recPrev) recPrev.disabled = false;
    if (recSave) recSave.disabled = false;
    if (recName) recName.value = song.name;
    renderTake(recTake, take);
    if (recStatus) recStatus.textContent = message || `${song.notes.length}음 초안이 준비되었습니다.`;
    if (autoplay) api.playSong(song, null);
    return song;
  }

  function clearDraft(message) {
    take = [];
    takeMeta = { bpm: 120, origin: 'recorded', name: '' };
    renderTake(recTake, []);
    if (recName) recName.value = '';
    if (recPrev) recPrev.disabled = true;
    if (recSave) recSave.disabled = true;
    if (recStatus && message) recStatus.textContent = message;
  }

  function stopRec(message) {
    recording = false;
    if (recBtn) recBtn.disabled = false;
    if (recStop) recStop.disabled = true;
    const hasNotes = take.length > 0;
    if (recPrev) recPrev.disabled = !hasNotes;
    if (recSave) recSave.disabled = !hasNotes;
    if (recStatus) recStatus.textContent = message ||
      (hasNotes ? `■ ${take.length}음 녹음됨 — 미리듣기 후 저장하세요.` : '녹음된 음이 없습니다. 다시 시도해 보세요.');
  }

  if (recBtn) recBtn.addEventListener('click', () => {
    api.stopAll();
    scRecording = false;
    recording = true;
    take = [];
    takeMeta = { bpm: 120, origin: 'recorded', name: '' };
    Object.keys(open).forEach((id) => { delete open[id]; });
    renderTake(recTake, []);
    recBtn.disabled = true;
    recStop.disabled = false;
    recPrev.disabled = true;
    recSave.disabled = true;
    recStatus.textContent = `● 녹음 중… 오카리나를 연주하세요 (최대 ${MAX_NOTES}음)`;
  });
  if (recStop) recStop.addEventListener('click', () => stopRec());
  if (recPrev) recPrev.addEventListener('click', () => {
    const song = takeToSong('preview');
    if (song) api.playSong(song, null);
  });
  if (recSave) recSave.addEventListener('click', () => {
    const song = takeToSong(recName && recName.value.trim());
    if (!song) return;
    const result = addSong(song);
    clearDraft(result.added
      ? '💾 저장되었습니다! 아래 “내 노래”에서 연주하거나 해시 링크로 공유할 수 있어요.'
      : '이미 같은 곡이 “내 노래”에 저장되어 있습니다.');
  });

  /* ------------------------------------------------------- Random composer */
  const randomBtn = $('#random-generate'), randomLength = $('#random-length');
  const randomStyle = $('#random-style'), randomBpm = $('#random-bpm');

  const randomPick = (items, rng) => items[Math.floor(rng() * items.length) % items.length];
  const clampScale = (value) => Math.max(0, Math.min(SCALE.length - 1, value));

  function randomSongName(rng) {
    const first = ['별빛', '달빛', '새벽', '숲길', '바람', '호수', '노을', '구름'];
    const last = ['메아리', '산책', '꿈', '노래', '왈츠', '기억', '소원', '편지'];
    return `${randomPick(first, rng)}의 ${randomPick(last, rng)}`;
  }

  function makeMotif(style, rng) {
    const stepPools = {
      calm: [-1, 0, 0, 1, 1],
      balanced: [-2, -1, -1, 0, 1, 1, 2],
      lively: [-2, -1, -1, 1, 1, 2, 2],
    };
    let current = randomPick([0, 1, 2], rng);
    const motif = [current];
    while (motif.length < 4) {
      const next = clampScale(current + randomPick(stepPools[style] || stepPools.balanced, rng));
      current = motif.length > 1 && next === motif[motif.length - 1] && next === motif[motif.length - 2]
        ? clampScale(next + (rng() < 0.5 ? -1 : 1)) : next;
      motif.push(current);
    }
    return motif;
  }

  function generateRandomSong(options, rng) {
    const config = options || {};
    const random = rng || Math.random;
    const count = [8, 16, 24, 32].includes(Number(config.length)) ? Number(config.length) : 16;
    const style = ['calm', 'balanced', 'lively'].includes(config.style) ? config.style : 'balanced';
    const bpm = clampBpm(config.bpm || 108);
    const motif = makeMotif(style, random);
    const rhythmPools = {
      calm: [1, 1, 1.5, 2],
      balanced: [0.5, 1, 1, 1, 1.5],
      lively: [0.5, 0.5, 0.5, 1, 1],
    };
    const notes = [];

    for (let index = 0; index < count; index += 1) {
      const phrase = Math.floor(index / 4);
      const within = index % 4;
      let scaleIndex = motif[within];
      // Repeat the motif recognisably, with one small variation per phrase.
      if (phrase % 2 === 1 && within >= 2) {
        scaleIndex = clampScale(scaleIndex + (random() < 0.5 ? -1 : 1));
      } else if (phrase % 4 === 2 && within === 1) {
        scaleIndex = clampScale(scaleIndex + (random() < 0.5 ? -2 : 2));
      }
      // Every eight notes breathe at a D; the final note resolves to low D.
      if ((index + 1) % 8 === 0) scaleIndex = random() < 0.68 ? 0 : 4;
      if (index === count - 1) scaleIndex = 0;

      let beats = randomPick(rhythmPools[style], random);
      if ((index + 1) % 4 === 0) beats = style === 'lively' ? 1 : 1.5;
      if ((index + 1) % 8 === 0) beats = 2;
      if (index === count - 1) beats = style === 'calm' ? 3 : 2;
      notes.push([SCALE[scaleIndex], beats]);
    }

    return normalizeSong({
      id: idNow(),
      name: config.name || randomSongName(random),
      bpm,
      notes,
      origin: 'random',
      created: Date.now(),
    });
  }

  if (randomBtn) randomBtn.addEventListener('click', () => {
    const song = generateRandomSong({
      length: Number(randomLength && randomLength.value),
      style: randomStyle && randomStyle.value,
      bpm: Number(randomBpm && randomBpm.value),
    });
    setDraft(song, `🎲 “${song.name}” ${song.notes.length}음을 만들었습니다 — 미리듣기 중이며 이름을 바꿔 저장할 수 있어요.`, true);
  });

  /* --------------------------------------------------------- External import */
  const extData = $('#ext-data'), extName = $('#ext-name'), extBpm = $('#ext-bpm');
  const extPreview = $('#ext-preview'), extAdd = $('#ext-add'), extFile = $('#ext-file');
  const extStatus = $('#ext-status');

  function parseTextNotes(text) {
    const tokens = String(text).trim().split(/[\s,|]+/).filter(Boolean);
    if (!tokens.length) return [];
    return tokens.map((token) => {
      const match = token.match(/^(.*?)(?:(?::|\/|\*)(0?\.25|0?\.5|0?\.75|1(?:\.5)?|2|3|4))?$/);
      if (!match || !match[1]) throw new Error(`형식을 확인할 수 없는 음표 “${token}”`);
      const id = noteId(match[1]);
      if (!id) throw new Error(`알 수 없는 음표 “${match[1]}”`);
      return [id, closestBeat(match[2] || 1)];
    });
  }

  function parseExternalSong(value, overrides) {
    const text = String(value || '').trim();
    const opts = overrides || {};
    if (!text) throw new Error('공유 링크, JSON 또는 음표를 입력하세요.');

    const shared = songFromHash(text);
    if (shared) {
      if (opts.name) shared.name = String(opts.name).trim().slice(0, 24);
      if (opts.bpm) shared.bpm = clampBpm(opts.bpm);
      shared.shared = true;
      return shared;
    }

    let parsed = null;
    if (/^[\[{]/.test(text)) {
      try { parsed = JSON.parse(text); } catch (e) { throw new Error('JSON 형식이 올바르지 않습니다.'); }
    }
    if (parsed != null) {
      const source = Array.isArray(parsed) ? { notes: parsed } : parsed;
      const song = normalizeSong({
        name: opts.name || source.name || source.n || '가져온 곡',
        bpm: opts.bpm || source.bpm || source.b || 120,
        notes: source.notes || source.s,
        origin: source.origin || CODE_ORIGIN[source.o] || 'external',
        shared: !!source.shared,
      }, { strict: true, origin: 'external' });
      if (!song) throw new Error('JSON 안에 연주 가능한 음표가 없습니다.');
      return song;
    }

    const notes = parseTextNotes(text);
    if (notes.length > MAX_NOTES) throw new Error(`한 곡은 최대 ${MAX_NOTES}음까지 가져올 수 있습니다.`);
    return normalizeSong({
      name: opts.name || '가져온 곡',
      bpm: opts.bpm || 120,
      notes,
      origin: 'external',
    }, { strict: true });
  }

  function externalSong() {
    return parseExternalSong(extData && extData.value, {
      name: extName && extName.value.trim(),
      bpm: extBpm && extBpm.value,
    });
  }

  if (extPreview) extPreview.addEventListener('click', () => {
    try {
      const song = externalSong();
      api.playSong(song, null);
      if (extStatus) extStatus.textContent = `▶ “${song.name}” ${song.notes.length}음을 미리듣는 중입니다.`;
    } catch (error) {
      if (extStatus) extStatus.textContent = `⚠ ${error.message}`;
    }
  });

  if (extAdd) extAdd.addEventListener('click', () => {
    try {
      const song = externalSong();
      const result = addSong(song, { origin: song.origin || 'external' });
      if (extStatus) extStatus.textContent = result.added
        ? `📥 “${result.song.name}”을 내 노래에 추가했습니다 — 카드의 🔗로 공유할 수 있어요.`
        : '이미 같은 이름·음표·빠르기의 곡이 내 노래에 있습니다.';
    } catch (error) {
      if (extStatus) extStatus.textContent = `⚠ ${error.message}`;
    }
  });

  if (extFile) extFile.addEventListener('change', async () => {
    const file = extFile.files && extFile.files[0];
    if (!file) return;
    try {
      if (extData) extData.value = await file.text();
      if (extName && !extName.value) extName.value = file.name.replace(/\.[^.]+$/, '').slice(0, 24);
      if (extStatus) extStatus.textContent = `📄 ${file.name}을 불러왔습니다 — 미리듣기 후 추가하세요.`;
    } catch (error) {
      if (extStatus) extStatus.textContent = '⚠ 파일을 읽지 못했습니다.';
    }
  });

  /* ------------------------------------------------------ Scarecrow's Song */
  const scBtn = $('#scare-btn'), scClear = $('#scare-clear'), scStatus = $('#scare-status');
  let scRecording = false;
  let scTake = [];
  let scare = null;
  try { scare = JSON.parse(localStorage.getItem(LS_SCARE) || 'null'); } catch (e) { /* ignore */ }

  function applyScare() {
    const valid = Array.isArray(scare) && scare.length === 8 && scare.every((id) => NOTES[id]);
    api.setScarecrow(valid ? scare : null);
    if (scClear) scClear.hidden = !valid;
    if (scStatus) {
      if (valid) {
        renderTake(scStatus, scare);
        scStatus.insertAdjacentHTML('beforeend', '<em class="sc-ok"> ✔ 등록됨 — 자유 연주로 쳐보세요!</em>');
      } else {
        scStatus.innerHTML = '<em class="sc-none">아직 등록된 곡이 없습니다.</em>';
      }
    }
  }

  if (scBtn) scBtn.addEventListener('click', () => {
    api.stopAll();
    recording = false;
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
      if (take.length >= MAX_NOTES) {
        stopRec(`■ 최대 ${MAX_NOTES}음까지 녹음됩니다 — 자동으로 정지했어요.`);
        return;
      }
      const note = { id, t: performance.now(), d: 0 };
      take.push(note);
      open[id] = note;
      renderTake(recTake, take);
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
    const note = open[id];
    if (note) { note.d = performance.now() - note.t; delete open[id]; }
  });

  /* ------------------------------------------------------------ My songs */
  const list = $('#comp-list'), countEl = $('#comp-count');

  function copyShareLink(song, button) {
    const url = shareLink(song);
    const done = () => {
      if (recStatus) recStatus.textContent = `🔗 “${song.name}” 공유 링크를 복사했습니다 — 주소 해시에 곡이 들어 있습니다.`;
      if (button) {
        const before = button.textContent;
        button.textContent = '✓';
        setTimeout(() => { button.textContent = before; }, 1200);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, () => window.prompt('이 링크를 복사하세요:', url));
    } else {
      window.prompt('이 링크를 복사하세요:', url);
    }
    return url;
  }

  function renderComps() {
    if (!list) return;
    if (countEl) countEl.textContent = comps.length ? `${comps.length}곡` : '';
    if (!comps.length) {
      list.innerHTML = '<p class="comp-empty">아직 저장한 노래가 없습니다 — 직접 녹음하거나 랜덤 생성·외부 가져오기를 사용해 보세요! 🎶</p>';
      return;
    }
    list.innerHTML = '';
    comps.forEach((song, index) => {
      const card = document.createElement('article');
      card.className = 'song-card comp';
      card.dataset.song = song.id;
      const source = ORIGIN_LABEL[song.origin] || ORIGIN_LABEL.recorded;
      card.innerHTML =
        `<header><div class="title"><h3 class="c-name">${esc(song.name)}</h3>` +
        `<span class="ko"><span class="comp-source">${source}</span>${song.shared ? ' · 공유받음' : ''} · ${song.notes.length}음</span></div>` +
        `<span class="bpm">♩=${song.bpm}</span></header>` +
        `<div class="tabs">${api.tabHTML(song)}</div>` +
        api.staffSVG(song) +
        `<div class="actions">` +
        `<button class="play-btn">▶ Play</button>` +
        `<button class="mini-btn share-btn" type="button" aria-label="${esc(song.name)} 공유 링크 복사" title="주소 해시 공유 링크 복사">🔗</button>` +
        `<button class="mini-btn del-btn" type="button" aria-label="${esc(song.name)} 삭제" title="삭제">🗑</button>` +
        `</div>`;
      $('.play-btn', card).addEventListener('click', () => {
        const playing = card.classList.contains('playing') && api.isPlaying();
        if (playing) api.stopAll();
        else api.playSong(song, card);
      });
      $('.share-btn', card).addEventListener('click', (event) => copyShareLink(song, event.currentTarget));
      $('.del-btn', card).addEventListener('click', () => {
        if (!window.confirm(`“${song.name}”을(를) 삭제할까요?`)) return;
        comps.splice(index, 1);
        saveComps();
        renderComps();
      });
      list.appendChild(card);
    });
  }

  /* ----------------------------------------------- Import from share link */
  function importFromHash() {
    const code = codeFromHash(location.hash);
    if (!code) return null;
    try {
      const shared = decodeSongCode(code);
      shared.shared = true;
      const result = addSong(shared, { origin: shared.origin || 'shared', shared: true });
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => {
        const studioTab = $('#tabbtn-studio');
        if (studioTab) studioTab.click();
        if (recStatus) recStatus.textContent = result.added
          ? `✦ 공유 링크에서 “${result.song.name}”을 내 노래로 가져왔습니다.`
          : `✦ “${result.song.name}”은 이미 내 노래에 있습니다.`;
        const card = list && list.querySelector(`[data-song="${result.song.id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return result.song;
    } catch (error) {
      if (recStatus) recStatus.textContent = '⚠ 공유 링크의 곡 정보를 읽지 못했습니다.';
      return null;
    }
  }

  document.addEventListener('oot:stop', () => {
    recording = false;
    scRecording = false;
    if (recBtn) recBtn.disabled = false;
    if (recStop) recStop.disabled = true;
  });

  applyScare();
  renderComps();
  importFromHash();
  window.addEventListener('hashchange', importFromHash);

  // A small public surface keeps the codec/parser/generator testable and lets
  // future importers use exactly the same validation as the UI.
  OOT.studio = {
    encodeSong,
    decodeSongCode,
    songFromHash,
    shareLink,
    parseExternalSong,
    generateRandomSong,
    maxNotes: MAX_NOTES,
  };
})();
