/* ============================================================================
 * Ocarina of Time — full-range ocarina mode
 * ----------------------------------------------------------------------------
 * The Zelda mode plays the five in-game notes. This module unlocks the whole
 * instrument: a 12-hole alto C ocarina's real range, A4–F6, fully chromatic.
 *
 *  - A piano-style keyboard (mouse / multi-touch / computer keys), mountable
 *    anywhere via OOT.full.mount(), with press-and-hold sustain.
 *  - A live 12-hole fingering chart that follows whatever note sounds, using
 *    the same hole layout the 배우기 curriculum teaches (L1…SL, R1…SR, TL/TR).
 *  - Its own note bus (OOT.full.onNote / onNoteEnd) so the repertoire tab and
 *    learn mode can run guided practice without touching the Zelda pipeline.
 * ==========================================================================*/
(function () {
  'use strict';
  if (!window.OOT || !OOT.api) return;
  const { api } = OOT;
  const $ = (s, r = document) => r.querySelector(s);

  /* ------------------------------------------------- Notes: A4–F6 chromatic */
  const SEQ = ['A4', 'A#4', 'B4', 'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5',
               'G5', 'G#5', 'A5', 'A#5', 'B5', 'C6', 'C#6', 'D6', 'D#6', 'E6', 'F6'];
  const SOLFEGE = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };
  const KEYMAP = {                       // computer keys: two QWERTY rows
    KeyZ: 'A4', KeyS: 'A#4', KeyX: 'B4', KeyC: 'C5', KeyF: 'C#5', KeyV: 'D5',
    KeyG: 'D#5', KeyB: 'E5', KeyN: 'F5', KeyJ: 'F#5', KeyM: 'G5', KeyK: 'G#5',
    KeyQ: 'A5', Digit2: 'A#5', KeyW: 'B5', KeyE: 'C6', Digit4: 'C#6',
    KeyR: 'D6', Digit5: 'D#6', KeyT: 'E6', KeyY: 'F6',
  };
  const KEYCHAR = {};                    // note id -> printable key label
  Object.keys(KEYMAP).forEach((code) => {
    KEYCHAR[KEYMAP[code]] = code.replace('Key', '').replace('Digit', '');
  });

  const NOTES = {};
  SEQ.forEach((id, i) => {
    const letter = id[0];
    const sharp = id.includes('#');
    NOTES[id] = {
      id,
      freq: 440 * Math.pow(2, i / 12),   // A4 = 440, up in semitones
      sharp,
      label: SOLFEGE[letter] + (sharp ? '♯' : ''),
      name: id,
      key: KEYCHAR[id] || '',
    };
  });

  /* -------------------------------------- 12-hole fingering (alto C 표준형) */
  // Verified against Pure Ocarinas / STL Ocarina alto-C charts (Asian system):
  // A4 everything closed; the two SUBHOLES vent first (A#4 = right sub, B4 =
  // left sub, C5 = both), then fingers lift far-to-near — R4 R3 R2 R1, L3 L2
  // L1 — then the thumbs (D6 = left, E6 = right), and finally the left pinky
  // for the top F6 (all twelve holes open).
  const HOLES = ['L1', 'L2', 'L3', 'L4', 'SL', 'R1', 'R2', 'R3', 'R4', 'SR', 'TL', 'TR'];
  const LADDER = { D5: 'R4', E5: 'R3', F5: 'R2', G5: 'R1', A5: 'L3', B5: 'L2',
                   C6: 'L1', D6: 'TL', E6: 'TR', F6: 'L4' };
  // Sharps ARE playable on a real ocarina — by cross-fingering (re-closing a
  // hole below the open ladder) or half-holing (◐). These are the common
  // charts' versions; makers differ, so they stay flagged as `cross`.
  //   C#5 = C5 grip + right pinky half    D#5 = open ring, RE-CLOSE pinky
  //   F#5 = open middle, re-close ring    G#5 = open left ring, re-close R index
  //   A#5 = open left middle, re-close left ring
  //   C#6 = C6 grip + left thumb half     D#6 = D6 grip + right thumb half
  const SHARP_GRIPS = {
    'A#4': { open: ['SR'], half: [], cross: false },   // standard subhole vent
    'C#5': { open: ['SL', 'SR'], half: ['R4'] },
    'D#5': { open: ['SL', 'SR', 'R3'], half: [] },
    'F#5': { open: ['SL', 'SR', 'R4', 'R2'], half: [] },
    'G#5': { open: ['SL', 'SR', 'R4', 'R3', 'R2', 'L3'], half: [] },
    'A#5': { open: ['SL', 'SR', 'R4', 'R3', 'R2', 'R1', 'L2'], half: [] },
    'C#6': { open: ['SL', 'SR', 'R4', 'R3', 'R2', 'R1', 'L3', 'L2', 'L1'], half: ['TL'] },
    'D#6': { open: ['SL', 'SR', 'R4', 'R3', 'R2', 'R1', 'L3', 'L2', 'L1', 'TL'], half: ['TR'] },
  };
  const FINGERINGS = {};                 // note id -> { closed: [...], half: [...], cross }
  (function buildFingerings() {
    const set = (id, open, half, cross) => {
      FINGERINGS[id] = {
        closed: HOLES.filter((h) => !open.includes(h) && !half.includes(h)),
        half,
        cross: !!cross,
      };
    };
    set('A4', [], []);
    set('B4', ['SL'], []);
    let open = ['SL', 'SR'];
    set('C5', open, []);
    SEQ.forEach((id) => {
      if (NOTES[id].sharp) {
        const g = SHARP_GRIPS[id];
        set(id, g.open, g.half, g.cross !== false);
      } else if (LADDER[id]) {
        open = open.concat(LADDER[id]);
        set(id, open, []);
      }
    });
  })();

  function chartHTML(id) {
    const f = FINGERINGS[id];
    if (!f) return '';
    const closed = new Set(f.closed);
    const half = new Set(f.half);
    const state = (h) => (closed.has(h) ? 'closed' : half.has(h) ? 'half' : 'open');
    const WORD = { closed: '막음', half: '반만 막음', open: '엶' };
    const hole = (h, label, small) =>
      `<span class="fh-wrap"><span class="fh${small ? ' small' : ''} ${state(h) === 'open' ? '' : state(h)}" role="img" ` +
      `aria-label="${label} ${WORD[state(h)]}"></span>` +
      `<span class="fh-label" aria-hidden="true">${label}</span></span>`;
    return `<div class="fing">` +
      `<div class="fing-row"><span class="fing-side">앞면 · 왼손</span>` +
      hole('L1', '검지') + hole('L2', '중지') + hole('L3', '약지') + hole('L4', '새끼') + hole('SL', '보조', true) + `</div>` +
      `<div class="fing-row"><span class="fing-side">앞면 · 오른손</span>` +
      hole('R1', '검지') + hole('R2', '중지') + hole('R3', '약지') + hole('R4', '새끼') + hole('SR', '보조', true) + `</div>` +
      `<div class="fing-row"><span class="fing-side">뒷면 · 엄지</span>` + hole('TL', '왼엄지') + hole('TR', '오른엄지') + `</div>` +
      `</div>` +
      `<p class="fing-note">${fullName(id)}${f.half.length ? ' — ◐ 반홀' : ''}${f.cross ? ' · 교차 운지 (제조사별 상이, 악기 운지표 확인)' : ''}</p>`;
  }

  function fullName(id) { return `${NOTES[id].label} (${id})`; }

  /* ------------------------------------------------------------- Note bus */
  const noteSubs = new Set(), endSubs = new Set();
  const active = new Set(), previewActive = new Set();
  let keyboards = [];                    // every mounted keyboard root

  function eachKey(id, fn) {
    keyboards = keyboards.filter((kb) => kb.isConnected);
    keyboards.forEach((kb) => {
      const el = kb.querySelector(`[data-note="${CSS.escape(id)}"]`);
      if (el) fn(el);
    });
  }

  function updateChart(id) {
    document.querySelectorAll('.full-chart').forEach((box) => { box.innerHTML = chartHTML(id); });
  }

  // Mirror the fingering on the ocarina photo itself, like the Zelda-mode
  // hole glow: gold = cover this hole, blue ring = leave it open.
  const fingLayer = document.querySelector('.oca-fing');
  let photoClearT = 0;
  function updatePhoto(id, transientMs) {
    if (!fingLayer) return;
    clearTimeout(photoClearT);
    const f = FINGERINGS[id];
    if (!f) return;
    const closed = new Set(f.closed);
    const half = new Set(f.half);
    fingLayer.querySelectorAll('.fhole').forEach((el) => {
      const h = el.dataset.fhole;
      el.classList.toggle('press', closed.has(h));
      el.classList.toggle('half', half.has(h));
      el.classList.toggle('open', !closed.has(h) && !half.has(h));
    });
    if (transientMs) photoClearT = setTimeout(clearPhoto, transientMs);
  }
  function clearPhoto() {
    clearTimeout(photoClearT);
    if (!fingLayer) return;
    fingLayer.querySelectorAll('.fhole').forEach((el) => el.classList.remove('press', 'half', 'open'));
  }

  function startNote(id) {
    if (!NOTES[id] || active.has(id)) return;
    active.add(id);
    api.synth.ensure();
    api.synth.noteOn('F:' + id, NOTES[id].freq);
    eachKey(id, (el) => el.classList.add('on'));
    updateChart(id);
    updatePhoto(id);
    noteSubs.forEach((f) => { try { f(id); } catch (e) { /* listener error */ } });
    if (OOT.progress) OOT.progress.event('fullnote');
  }

  function endNote(id) {
    if (!active.delete(id)) return;
    api.synth.noteOff('F:' + id);
    if (!previewActive.has(id)) eachKey(id, (el) => el.classList.remove('on'));
    // once every key is up, let the photo's fingering linger a beat, then fade
    if (active.size === 0 && previewActive.size === 0) photoClearT = setTimeout(clearPhoto, 280);
    endSubs.forEach((f) => { try { f(id); } catch (e) { /* listener error */ } });
  }

  // Cancellable preview notes power the song-name listening wheel. They share
  // keyboard/fingering feedback but stay off the input bus and progress count.
  function startPreview(id) {
    if (!NOTES[id] || previewActive.has(id)) return;
    previewActive.add(id);
    api.synth.ensure();
    api.synth.noteOn('FP:' + id, NOTES[id].freq);
    eachKey(id, (el) => el.classList.add('on'));
    updateChart(id);
    updatePhoto(id);
  }

  function endPreview(id) {
    if (!previewActive.delete(id)) return;
    api.synth.noteOff('FP:' + id);
    if (!active.has(id)) eachKey(id, (el) => el.classList.remove('on'));
    if (active.size === 0 && previewActive.size === 0) photoClearT = setTimeout(clearPhoto, 280);
  }

  function stopPreview() { [...previewActive].forEach(endPreview); }
  function stopAllFull() { [...active].forEach(endNote); stopPreview(); }

  // one-shot playback (auto-play / previews) with the same visual feedback
  function play(id, dur = 0.55) {
    if (!NOTES[id]) return;
    api.synth.ensure();
    api.synth.play(NOTES[id].freq, dur);
    eachKey(id, (el) => {
      el.classList.add('on');
      setTimeout(() => {
        if (!active.has(id) && !previewActive.has(id)) el.classList.remove('on');
      }, Math.min(900, dur * 1000));
    });
    updateChart(id);
    updatePhoto(id, Math.min(900, dur * 1000));
  }

  /* ------------------------------------------------------ Keyboard factory */
  function mount(container, opts = {}) {
    if (!container) return null;
    const kb = document.createElement('div');
    kb.className = 'okb' + (opts.small ? ' okb-small' : '');
    kb.setAttribute('role', 'group');
    kb.setAttribute('aria-label', '오카리나 건반 (라4–파6)');
    // Two octave rows matching the computer-key rows (Z-row / Q-row). On
    // desktop the rows use display:contents, flattening into one piano; on
    // phones each row is its own line so nothing needs horizontal scrolling.
    const whites = SEQ.filter((id) => !NOTES[id].sharp);
    const rows = [whites.slice(0, whites.indexOf('A5')), whites.slice(whites.indexOf('A5'))];
    rows.forEach((rowIds) => {
      const row = document.createElement('div');
      row.className = 'okb-row';
      rowIds.forEach((id) => {
        const w = document.createElement('div');
        w.className = 'k-slot';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'k-white';
        btn.dataset.note = id;
        btn.setAttribute('aria-label', `${fullName(id)}, 키 ${NOTES[id].key}`);
        btn.innerHTML = `<span class="k-sol">${NOTES[id].label}</span>` +
          `<span class="k-name">${id}</span><span class="k-kbd">${NOTES[id].key}</span>`;
        w.appendChild(btn);
        const sharpId = id.replace(/(\d)/, '#$1');
        if (NOTES[sharpId]) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'k-black';
          b.dataset.note = sharpId;
          b.setAttribute('aria-label', `${fullName(sharpId)}, 키 ${NOTES[sharpId].key}`);
          b.innerHTML = `<span class="k-sol">${NOTES[sharpId].label}</span>` +
            `<span class="k-kbd">${NOTES[sharpId].key}</span>`;
          w.appendChild(b);
        }
        row.appendChild(w);
      });
      kb.appendChild(row);
    });

    // press-and-hold with pointer capture; multi-touch plays chords.
    // A key counts every pointer resting on it, so two fingers on the same
    // key sustain the note until the LAST one lifts.
    const pids = new Map();              // key element -> Set of pointer ids
    kb.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-note]');
      if (!btn) return;
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (!pids.has(btn)) pids.set(btn, new Set());
      pids.get(btn).add(e.pointerId);
      startNote(btn.dataset.note);
    });
    const lift = (e) => {
      const btn = e.target.closest('[data-note]');
      const held = btn && pids.get(btn);
      if (held && held.delete(e.pointerId) && held.size === 0) {
        pids.delete(btn);
        endNote(btn.dataset.note);
      }
    };
    kb.addEventListener('pointerup', lift);
    kb.addEventListener('pointercancel', lift);
    kb.addEventListener('contextmenu', (e) => e.preventDefault());

    // the keys are real buttons: Enter / Space must play them too
    kb.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const btn = e.target.closest('[data-note]');
      if (!btn || e.repeat) return;
      e.preventDefault();
      startNote(btn.dataset.note);
    });
    kb.addEventListener('keyup', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const btn = e.target.closest('[data-note]');
      if (btn) endNote(btn.dataset.note);
    });

    container.appendChild(kb);
    keyboards.push(kb);
    return kb;
  }

  /* --------------------------------------------------- Computer keyboard */
  const heldK = new Set();
  const kbVisible = () => keyboards.some((kb) => kb.isConnected && kb.offsetParent !== null);

  document.addEventListener('keydown', (e) => {
    const id = KEYMAP[e.code];
    if (!id || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    if (el && el.closest && el.closest('input, select, textarea, [contenteditable]')) return;
    if (!kbVisible()) return;
    e.preventDefault();
    if (e.repeat || heldK.has(id)) return;
    heldK.add(id);
    startNote(id);
  });
  document.addEventListener('keyup', (e) => {
    const id = KEYMAP[e.code];
    if (id && heldK.delete(id)) endNote(id);
  });
  window.addEventListener('blur', () => { heldK.clear(); stopAllFull(); });

  /* ------------------------------------------------------- Mode toggle */
  const modeZelda = $('#mode-zelda'), modeFull = $('#mode-full');
  const fullKit = $('#full-kit');
  const instrument = document.querySelector('.instrument');

  function setMode(full) {
    document.body.classList.toggle('full-on', full);
    if (modeZelda) { modeZelda.classList.toggle('on', !full); modeZelda.setAttribute('aria-pressed', String(!full)); }
    if (modeFull) { modeFull.classList.toggle('on', full); modeFull.setAttribute('aria-pressed', String(full)); }
    if (fullKit) fullKit.hidden = !full;
    api.stopAll();
    stopAllFull();
    clearPhoto();
    // repertoire playback / practice and games listen for this
    document.dispatchEvent(new CustomEvent('oot:stop'));
    // the keyboard's songbook is the repertoire — bring it up alongside,
    // and step back to the Zelda songbook when the mode is switched off
    const repPanel = $('#panel-repertoire');
    if (full && repPanel && repPanel.hidden) {
      const t = $('#tabbtn-repertoire');
      if (t) t.click();
    } else if (!full && repPanel && !repPanel.hidden) {
      const t = $('#tabbtn-songbook');
      if (t) t.click();
    }
  }
  if (modeZelda) modeZelda.addEventListener('click', () => setMode(false));
  if (modeFull) modeFull.addEventListener('click', () => setMode(true));

  // the main keyboard lives inside the instrument panel
  if (fullKit) {
    mount($('#full-kb'));
    updateChart('C5');                   // a friendly default chart
  }

  /* ---------------------------------------------------------- Public api */
  OOT.full = {
    NOTES, SEQ,
    mount,
    startNote, endNote, play,
    startPreview, endPreview, stopPreview,
    stopAll: stopAllFull,
    isActive: (id) => active.has(id),
    onNote: (f) => { noteSubs.add(f); return () => noteSubs.delete(f); },
    onNoteEnd: (f) => { endSubs.add(f); return () => endSubs.delete(f); },
    chartHTML, fullName,
    setMode,
  };

  document.addEventListener('oot:stop', stopAllFull);
  document.addEventListener('oot:tab', stopAllFull);
})();
