/* ============================================================================
 * Ocarina of Time — games: rhythm challenge, melody quiz, echo (Simon)
 * ==========================================================================*/
(function () {
  'use strict';
  if (!window.OOT || !OOT.api) return;
  const { api, SONGS, NOTES } = OOT;
  const $ = (s, r = document) => r.querySelector(s);
  const rand = (n) => Math.floor(Math.random() * n);
  const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const NOTE_IDS = ['A', 'down', 'right', 'up', 'left'];

  /* ========================================================= Rhythm game */
  const APPROACH = 2600;                 // ms a note falls before the hit line
  const PERFECT_MS = 90;
  const GOOD_MS = 220;
  const HOLD_RELEASE_GRACE = 180;
  const HIT_OFF = 14;
  const CHIP_H = 22;                     // must match .rg-chip height
  const FULL_CHIP_H = 38;                // must match .rg-chip.full height
  const MEDLEY_GAP = 1400;
  const ZELDA_LANES = ['left', 'down', 'up', 'right', 'A'];
  const FULL = OOT.full;
  const REPERTOIRE = Array.isArray(OOT.REPERTOIRE) ? OOT.REPERTOIRE : [];
  const rgSel = $('#rg-song'), rgStart = $('#rg-start'), rgStop = $('#rg-stop');
  const rgModeZelda = $('#rg-mode-zelda'), rgModeFull = $('#rg-mode-full');
  const rgCountWrap = $('#rg-medley-count');
  const rgCountBtns = rgCountWrap ? [...rgCountWrap.querySelectorAll('[data-count]')] : [];
  const rgField = $('#rg-field'), rgStage = $('#rg-stage'), rgResult = $('#rg-result');
  const rgFullKb = $('#rg-full-kb');
  const rgScoreEl = $('#rg-score'), rgComboEl = $('#rg-combo'), rgJudgeEl = $('#rg-judge'), rgBestEl = $('#rg-best');
  const rgNowEl = $('#rg-now'), rgNextEl = $('#rg-next');

  let rgMode = 'zelda';
  let rgMedleyCount = 5;
  let rg = { on: false, mode: rgMode, chips: [], held: new Set(), raf: 0 };
  let rhythmBest = readLS('oot-rhythm', {});
  const rgCols = {};                     // note id / "full" → .rg-notes box

  function clearRhythmLanes() {
    if (!rgStage) return;
    rgStage.querySelectorAll('.rg-col').forEach((el) => el.remove());
    Object.keys(rgCols).forEach((key) => { delete rgCols[key]; });
  }

  function buildRhythmLanes(mode) {
    if (!rgStage) return;
    clearRhythmLanes();
    if (mode === 'full') {
      const col = document.createElement('div');
      col.className = 'rg-col rg-col-full';
      col.dataset.note = 'full';
      const notes = document.createElement('div');
      notes.className = 'rg-notes';
      notes.setAttribute('aria-label', '전체 연주 노트 하이웨이');
      col.appendChild(notes);
      rgStage.appendChild(col);
      rgCols.full = notes;
      return;
    }
    ZELDA_LANES.forEach((id, i) => {
      const col = document.createElement('div');
      col.className = 'rg-col' + (i % 2 ? ' alt' : '') + (id === 'A' ? ' a' : '');
      col.dataset.note = id;
      const notes = document.createElement('div');
      notes.className = 'rg-notes';
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'rg-key';
      key.textContent = NOTES[id].arrow;
      key.setAttribute('aria-label', `${NOTES[id].key} 레인 (${NOTES[id].pitch})`);
      col.appendChild(notes);
      col.appendChild(key);
      rgStage.appendChild(col);
      rgCols[id] = notes;

      let held = false;
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        held = true;
        try { key.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        api.startNote(id);
      });
      const release = () => { if (held) { held = false; api.endNote(id); } };
      key.addEventListener('pointerup', release);
      key.addEventListener('pointercancel', release);
      key.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  if (rgFullKb && FULL) FULL.mount(rgFullKb, { small: true });

  function modeSongs(mode = rgMode) { return mode === 'full' ? REPERTOIRE : SONGS; }

  function bestKey(id, mode = rgMode, count = rgMedleyCount) {
    const scoped = id === 'medley' ? `medley:${count}` : id;
    return mode === 'full' ? `full:${scoped}` : scoped;
  }

  function updateMedleyControls() {
    if (!rgCountWrap || !rgSel) return;
    rgCountWrap.hidden = rgSel.value !== 'medley';
  }

  function setMedleyCount(count) {
    if (count !== 5 && count !== 10) return;
    rgMedleyCount = count;
    rgCountBtns.forEach((btn) => {
      const on = Number(btn.dataset.count) === count;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    showRgBest();
  }

  function populateRhythmSongs() {
    if (!rgSel) return;
    const full = rgMode === 'full';
    const songs = modeSongs();
    rgSel.innerHTML =
      `<option value="medley">🎲 ${full ? '세계의 곡' : '하이랄'} 랜덤 메들리</option>` +
      songs.map((s) => `<option value="${s.id}">${s.nameKo} · ${s.name}</option>`).join('');
    updateMedleyControls();
    showRgBest();
  }

  function setRhythmMode(mode) {
    if (mode === 'full' && (!FULL || !REPERTOIRE.length)) return;
    if (rg.on) rhythmStop(false);
    api.stopAll();
    if (FULL) FULL.stopAll();
    rgMode = mode;
    rg.mode = mode;
    if (rgModeZelda) {
      const on = mode === 'zelda';
      rgModeZelda.classList.toggle('on', on);
      rgModeZelda.setAttribute('aria-pressed', String(on));
    }
    if (rgModeFull) {
      const on = mode === 'full';
      rgModeFull.classList.toggle('on', on);
      rgModeFull.setAttribute('aria-pressed', String(on));
    }
    buildRhythmLanes(mode);
    populateRhythmSongs();
  }

  if (rgSel) rgSel.addEventListener('change', () => { updateMedleyControls(); showRgBest(); });
  rgCountBtns.forEach((btn) => btn.addEventListener('click', () => setMedleyCount(Number(btn.dataset.count))));
  if (rgModeZelda) rgModeZelda.addEventListener('click', () => setRhythmMode('zelda'));
  if (rgModeFull) rgModeFull.addEventListener('click', () => setRhythmMode('full'));
  setRhythmMode('zelda');

  function showRgBest() {
    if (!rgBestEl || !rgSel) return;
    const b = rhythmBest[bestKey(rgSel.value)];
    rgBestEl.textContent = b ? `최고 ${b.score}점 · ${b.grade}` : '기록 없음';
  }

  function chartNotes(song, mode = rg.mode) {
    if (mode === 'full') return song.notes;
    if (song.ext) return song.notes.concat(song.ext);
    const reprise = song.notes.map((n, i, a) => (i === a.length - 1 ? [n[0], n[1] + 1] : n));
    return song.notes.concat(reprise);
  }

  function randomSong(except) {
    const songs = modeSongs(rg.mode);
    let s;
    do { s = songs[rand(songs.length)]; } while (songs.length > 1 && s === except);
    return s;
  }

  // Full-range chips use the actual rendered key centres. On phones the
  // keyboard has two rows; both rows keep their own horizontal key geometry,
  // while the chip's note + octave label tells the player which row to press.
  function positionFullChip(chip) {
    if (!chip || !chip.el || !rgCols.full || !rgFullKb) return;
    const key = rgFullKb.querySelector(`[data-note="${chip.id}"]`);
    if (!key) return;
    const laneRect = rgCols.full.getBoundingClientRect();
    const keyRect = key.getBoundingClientRect();
    const row = key.closest('.okb-row');
    const rows = row && row.parentElement ? [...row.parentElement.querySelectorAll('.okb-row')] : [];
    const high = rows.indexOf(row) > 0;
    chip.el.classList.toggle('row-low', !high);
    chip.el.classList.toggle('row-high', high);
    chip.el.dataset.keyboardRow = high ? 'high' : 'low';

    let center;
    let width;
    if (laneRect.width > 0 && keyRect.width > 0) {
      center = keyRect.left + keyRect.width / 2 - laneRect.left;
      width = Math.max(36, Math.min(64, keyRect.width * 0.84));
    } else {
      // Geometry fallback for DOM-only tests and the first pre-layout frame.
      const slots = row ? [...row.querySelectorAll('.k-slot')] : [];
      const slot = key.closest('.k-slot');
      const i = Math.max(0, slots.indexOf(slot));
      const laneW = rgCols.full.clientWidth || 700;
      const sharp = key.classList.contains('k-black');
      center = ((i + (sharp ? 1 : 0.5)) / Math.max(1, slots.length)) * laneW;
      width = Math.max(36, Math.min(58, laneW / Math.max(7, slots.length) * (sharp ? 0.58 : 0.72)));
    }
    const laneW = laneRect.width || rgCols.full.clientWidth || 700;
    center = Math.max(width / 2 + 2, Math.min(laneW - width / 2 - 2, center));
    chip.el.style.left = `${center - width / 2}px`;
    chip.el.style.width = `${width}px`;
  }

  function positionFullChips() {
    if (!rg.on || rg.mode !== 'full') return;
    rg.chips.forEach(positionFullChip);
  }

  // Lay a song into the active highway. Beats >= 1.5 become real hold notes:
  // the tail represents duration and the player must keep the key down.
  function spawnSong(song, tFirst) {
    const beatMs = 60000 / song.bpm;
    let acc = 0;
    chartNotes(song).forEach(([id, beats]) => {
      const tHit = tFirst + acc * beatMs;
      const holdMs = beats >= 1.5 ? Math.max(280, (beats - 0.15) * beatMs) : 0;
      const el = document.createElement('span');
      el.dataset.note = id;
      el.dataset.beats = String(beats);
      if (holdMs) el.classList.add('long');
      if (rg.mode === 'full') {
        const n = FULL.NOTES[id];
        const pitchIndex = Math.max(0, FULL.SEQ.indexOf(id));
        el.classList.add('rg-chip', 'full');
        if (n.sharp) el.classList.add('sharp');
        el.style.setProperty('--pitch-h', String(196 + pitchIndex * 4.8));
        el.innerHTML = `<b>${n.label}</b><small>${id}</small>`;
        el.setAttribute('aria-label', `${n.label} ${id}${holdMs ? `, ${beats}박 장음` : ''}`);
        rgCols.full.appendChild(el);
      } else {
        el.classList.add('rg-chip');
        if (id === 'A') el.classList.add('a');
        el.textContent = NOTES[id].arrow;
        el.setAttribute('aria-label', `${NOTES[id].pitch}${holdMs ? `, ${beats}박 장음` : ''}`);
        rgCols[id].appendChild(el);
      }
      const chip = { id, el, beats, beatMs, holdMs, tHit, tRelease: tHit + holdMs,
                     started: false, startGrade: null, judged: false };
      rg.chips.push(chip);
      if (rg.mode === 'full') positionFullChip(chip);
      acc += beats;
    });
    return tFirst + acc * beatMs;
  }

  function setRunControls(disabled) {
    if (rgSel) rgSel.disabled = disabled;
    [rgModeZelda, rgModeFull, ...rgCountBtns].forEach((el) => { if (el) el.disabled = disabled; });
  }

  function rhythmStart() {
    stopGames();
    api.stopAll();
    if (FULL) FULL.stopAll();
    const mode = rgMode;
    const songs = modeSongs(mode);
    if (!songs.length) return;
    const medley = rgSel.value === 'medley';
    const songTarget = medley ? rgMedleyCount : 1;
    const song = medley ? songs[rand(songs.length)] : (songs.find((s) => s.id === rgSel.value) || songs[0]);
    buildRhythmLanes(mode);
    rgField.hidden = false; rgResult.hidden = true;
    rgField.classList.toggle('is-full', mode === 'full');
    if (rgFullKb) rgFullKb.hidden = mode !== 'full';
    document.body.classList.toggle('rg-full-game', mode === 'full');
    rgField.classList.remove('open');
    void rgField.offsetWidth;
    rgField.classList.add('open');
    rgStart.hidden = true; rgStop.hidden = false;
    rgStop.textContent = medley ? `■ 중지 · 0/${songTarget}곡` : '■ 중지';
    rgScoreEl.textContent = '0'; rgComboEl.textContent = '';
    if (rgNowEl) rgNowEl.textContent = ''; if (rgNextEl) rgNextEl.textContent = '';
    rgJudgeEl.textContent = '♪ ' + song.nameKo; rgJudgeEl.className = 'rg-pop hold';
    setRunControls(true);

    rg = { on: true, mode, medley, songTarget, chips: [], held: new Set(), raf: 0,
           score: 0, combo: 0, maxCombo: 0, counts: { P: 0, G: 0, M: 0 },
           judged: 0, songsStarted: 0, songsQueued: 1, lastSong: song,
           lastEnd: 0, pending: null };
    const t0 = performance.now() + 800 + APPROACH;
    rg.lastEnd = spawnSong(song, t0);
    rg.pending = { name: song.nameKo, t: t0, index: 1 };
    if (mode === 'full') requestAnimationFrame(positionFullChips);
    rgField.scrollIntoView({ behavior: api.prefersReduce() ? 'auto' : 'smooth', block: 'center' });
    rg.raf = requestAnimationFrame(rhythmFrame);
  }

  function holdPixels(c, remainingMs, laneH, travel) {
    if (!c.holdMs) return;
    const px = Math.max(18, Math.min(laneH * 0.82, (remainingMs / APPROACH) * travel));
    c.el.style.setProperty('--hold-px', `${px}px`);
  }

  function rhythmFrame() {
    if (!rg.on) return;
    const now = performance.now();

    if (rg.pending && now >= rg.pending.t) {
      rg.songsStarted++;
      const prefix = rg.medley ? `${rg.pending.index}/${rg.songTarget}곡 ` : '';
      if (rgNowEl) rgNowEl.textContent = prefix + '♪ ' + rg.pending.name;
      if (rgNextEl) rgNextEl.textContent = '';
      if (rgStop && rg.medley) rgStop.textContent = `■ 중지 · ${rg.songsStarted}/${rg.songTarget}곡`;
      rg.pending = null;
    }
    if (rg.medley && !rg.pending && rg.songsQueued < rg.songTarget) {
      const nextFirst = rg.lastEnd + MEDLEY_GAP;
      if (now >= nextFirst - APPROACH - 500) {
        const next = randomSong(rg.lastSong);
        rg.songsQueued++;
        rg.lastEnd = spawnSong(next, nextFirst);
        rg.lastSong = next;
        rg.pending = { name: next.nameKo, t: nextFirst, index: rg.songsQueued };
        if (rgNextEl) rgNextEl.textContent = `다음 ${rg.songsQueued}/${rg.songTarget} ♪ ${next.nameKo}`;
      }
    }

    const lane = rg.mode === 'full' ? rgCols.full : rgCols[ZELDA_LANES[0]];
    const laneH = (lane && lane.clientHeight) || 420;
    const hitY = laneH - HIT_OFF;
    const chipH = rg.mode === 'full' ? FULL_CHIP_H : CHIP_H;
    const travel = hitY + chipH;
    rg.chips.forEach((c) => {
      if (c.judged) return;
      if (c.started) {
        c.el.style.transform = `translateY(${hitY}px)`;
        holdPixels(c, Math.max(0, c.tRelease - now), laneH, travel);
        if (now >= c.tRelease) {
          if (rg.held.has(c.id)) judge(c, c.startGrade, c.startGrade === 'P' ? 'LONG PERFECT!' : 'LONG GOOD');
          else judge(c, 'M', 'HOLD MISS');
        }
        return;
      }
      const y = hitY - ((c.tHit - now) / APPROACH) * travel;
      c.el.style.transform = `translateY(${y}px)`;
      holdPixels(c, c.holdMs, laneH, travel);
      if (now - c.tHit > GOOD_MS) judge(c, 'M');
    });

    const chartDone = rg.judged >= rg.chips.length;
    const runDone = !rg.medley || rg.songsQueued >= rg.songTarget;
    if (chartDone && runDone) { rhythmEnd(false); return; }
    rg.raf = requestAnimationFrame(rhythmFrame);
  }

  function flashJudge(kind, text) {
    rgJudgeEl.textContent = text;
    rgJudgeEl.className = 'rg-pop j-' + kind.toLowerCase();
    void rgJudgeEl.offsetWidth;
    rgJudgeEl.classList.add('pop');
  }

  function rhythmHit(id) {
    if (!rg.on) return;
    const now = performance.now();
    let best = null;
    rg.chips.forEach((c) => {
      if (c.judged || c.started || c.id !== id) return;
      const dt = Math.abs(now - c.tHit);
      if (dt <= GOOD_MS && (!best || dt < best.dt)) best = { c, dt };
    });
    if (!best) return;
    const grade = best.dt <= PERFECT_MS ? 'P' : 'G';
    if (best.c.holdMs) {
      best.c.started = true;
      best.c.startGrade = grade;
      best.c.el.classList.add('holding');
      flashJudge(grade, grade === 'P' ? 'PERFECT · HOLD' : 'GOOD · HOLD');
    } else judge(best.c, grade);
  }

  function rhythmRelease(id) {
    if (!rg.on) return;
    rg.held.delete(id);
    const c = rg.chips.find((chip) => !chip.judged && chip.started && chip.id === id);
    if (!c) return;
    const now = performance.now();
    if (now < c.tRelease - HOLD_RELEASE_GRACE) {
      judge(c, 'M', 'HOLD MISS');
      return;
    }
    const precise = Math.abs(now - c.tRelease) <= PERFECT_MS && c.startGrade === 'P';
    judge(c, precise ? 'P' : 'G', precise ? 'LONG PERFECT!' : 'LONG GOOD');
  }

  const JUDGE_TXT = { P: 'PERFECT!', G: 'GOOD', M: 'MISS' };
  function judge(c, kind, label) {
    if (!c || c.judged) return;
    c.judged = true;
    c.el.classList.remove('holding');
    rg.judged++;
    rg.counts[kind]++;
    if (kind === 'M') { rg.combo = 0; c.el.classList.add('m'); }
    else {
      rg.score += kind === 'P' ? 100 : 60;
      rg.combo++;
      rg.maxCombo = Math.max(rg.maxCombo, rg.combo);
      c.el.classList.add(kind === 'P' ? 'p' : 'g');
    }
    const el = c.el;
    setTimeout(() => { if (el.isConnected) el.remove(); }, 700);
    rgScoreEl.textContent = rg.score;
    rgComboEl.textContent = rg.combo > 1 ? `콤보 ×${rg.combo}` : '';
    flashJudge(kind, (label || JUDGE_TXT[kind]) + (kind !== 'M' && rg.combo > 1 ? ` ×${rg.combo}` : ''));
  }

  function rhythmEnd(partial) {
    const total = partial ? rg.judged : rg.chips.length;
    const max = total * 100;
    const pct = max ? rg.score / max : 0;
    const grade = pct >= 0.95 ? 'S' : pct >= 0.8 ? 'A' : pct >= 0.6 ? 'B' : 'C';
    const songId = rg.medley ? 'medley' : rg.lastSong.id;
    const key = bestKey(songId, rg.mode, rg.songTarget);
    if (!partial) {
      const prev = rhythmBest[key];
      if (!prev || rg.score > prev.score) {
        rhythmBest[key] = { score: rg.score, grade };
        writeLS('oot-rhythm', rhythmBest);
      }
    }
    rgResult.hidden = false;
    rgResult.innerHTML =
      `<b class="grade g-${grade.toLowerCase()}">${grade}</b>` +
      `<span><b>${rg.mode === 'full' ? '전체 연주' : '젤다 5음'}</b> · ` +
      `${rg.medley ? `랜덤 ${rg.songTarget}곡${partial ? ` 중 ${rg.songsStarted}곡째 종료` : ' 완주'} · ` : ''}` +
      `점수 <b>${rg.score}</b> / ${max} · 최대 콤보 ×${rg.maxCombo}</span>` +
      `<span class="counts">Perfect ${rg.counts.P} · Good ${rg.counts.G} · Miss ${rg.counts.M}` +
      `${partial ? ' · 중도 종료 기록은 저장되지 않음' : ''}</span>`;
    if (!partial && OOT.progress) OOT.progress.event('rhythm', { songId: key, score: rg.score, grade });
    rhythmStop(true);
    showRgBest();
  }

  function rhythmStop(keepResult) {
    if (rg.raf) cancelAnimationFrame(rg.raf);
    rg.on = false;
    rg.raf = 0;
    if (rg.held) rg.held.clear();
    api.stopAll();
    if (FULL) FULL.stopAll();
    document.body.classList.remove('rg-full-game');
    setRunControls(false);
    if (rgField) {
      rgField.querySelectorAll('.rg-chip').forEach((el) => el.remove());
      rgField.hidden = true;
      rgField.classList.remove('open', 'is-full');
    }
    if (rgFullKb) rgFullKb.hidden = true;
    if (!keepResult && rgResult) rgResult.hidden = true;
    if (rgNowEl) rgNowEl.textContent = '';
    if (rgNextEl) rgNextEl.textContent = '';
    if (rgStart) rgStart.hidden = false;
    if (rgStop) rgStop.hidden = true;
  }

  if (rgStart) rgStart.addEventListener('click', rhythmStart);
  if (rgStop) rgStop.addEventListener('click', () => {
    if (rg.on && rg.judged > 0) rhythmEnd(true);
    else rhythmStop(false);
  });
  window.addEventListener('resize', () => { if (rg.on && rg.mode === 'full') requestAnimationFrame(positionFullChips); });

  // tiny read-only probe for tests/debugging
  OOT._rg = () => ({
    on: rg.on, mode: rg.mode, medley: !!rg.medley, target: rg.songTarget || 0,
    songs: rg.songsStarted || 0, queued: rg.songsQueued || 0, judged: rg.judged || 0,
    chips: rg.chips.length, longNotes: rg.chips.filter((c) => c.holdMs > 0).length,
    alignedFullNotes: rg.chips.filter((c) => c.el.dataset.keyboardRow).length,
  });

  /* ========================================================== Melody quiz */
  const qzPlay = $('#qz-play'), qzChoices = $('#qz-choices'), qzMsg = $('#qz-msg');
  const qzStreakEl = $('#qz-streak'), qzBestEl = $('#qz-best');
  let qz = { answer: null, last: null, streak: 0, best: readLS('oot-quiz', 0), timers: [], answered: true };
  if (qzBestEl) qzBestEl.textContent = qz.best;

  function quizStopTimers() { qz.timers.forEach(clearTimeout); qz.timers = []; }
  function quizStop() { quizStopTimers(); }

  // play a song silently (audio only — no button/hole light, or it would give
  // the answer away)
  function quizHear(song) {
    quizStopTimers();
    const beatMs = 60000 / song.bpm;
    let t = 250;
    song.notes.forEach(([id, beats]) => {
      const dur = Math.max(0.18, (beats * beatMs / 1000) * 0.94);
      qz.timers.push(setTimeout(() => api.synth.play(NOTES[id].freq, dur), t));
      t += beats * beatMs;
    });
  }

  function quizRound() {
    api.synth.ensure();
    let song;
    do { song = SONGS[rand(SONGS.length)]; } while (SONGS.length > 1 && song === qz.last);
    qz.last = song;
    qz.answer = song;
    qz.answered = false;
    quizHear(song);

    const pool = SONGS.filter((s) => s !== song);
    const choices = [song];
    while (choices.length < 4 && pool.length) choices.push(pool.splice(rand(pool.length), 1)[0]);
    choices.sort(() => Math.random() - 0.5);

    qzChoices.innerHTML = '';
    choices.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'qz-choice';
      b.innerHTML = `${s.name} <span lang="ko">${s.nameKo}</span>`;
      b.addEventListener('click', () => quizAnswer(b, s));
      qzChoices.appendChild(b);
    });
    qzMsg.textContent = '어떤 곡일까요? (다시 들으려면 문제 듣기를 누르세요)';
    qzPlay.textContent = '🔊 다시 듣기';
  }

  function quizAnswer(btn, s) {
    if (qz.answered) return;
    qz.answered = true;
    quizStopTimers();
    const right = s === qz.answer;
    qzChoices.querySelectorAll('.qz-choice').forEach((b) => { b.disabled = true; });
    btn.classList.add(right ? 'right' : 'wrong');
    if (!right) {
      [...qzChoices.children].forEach((b) => {
        if (b.textContent.includes(qz.answer.name)) b.classList.add('right');
      });
    }
    if (right) {
      qz.streak++;
      if (qz.streak > qz.best) { qz.best = qz.streak; writeLS('oot-quiz', qz.best); qzBestEl.textContent = qz.best; }
      qzMsg.textContent = `정답! 🎉 연속 ${qz.streak}회 — 다음 문제를 들어보세요.`;
    } else {
      qzMsg.textContent = `아쉬워요! 정답은 "${qz.answer.name}" 이었습니다.`;
      qz.streak = 0;
    }
    qzStreakEl.textContent = qz.streak;
    if (OOT.progress) OOT.progress.event('quiz', { streak: qz.streak });
    qzPlay.textContent = '🔊 다음 문제 듣기';
  }

  if (qzPlay) qzPlay.addEventListener('click', () => {
    if (qz.answered) quizRound();
    else quizHear(qz.answer);                       // replay the same question
  });

  /* ========================================================= Echo (Simon) */
  const smStart = $('#sm-start'), smMsg = $('#sm-msg'), smLevelEl = $('#sm-level'), smBestEl = $('#sm-best');
  let sm = { seq: [], idx: 0, phase: 'idle', best: readLS('oot-simon', 0), timers: [] };
  if (smBestEl) smBestEl.textContent = sm.best;

  function simonStopTimers() { sm.timers.forEach(clearTimeout); sm.timers = []; }
  function simonStop() { simonStopTimers(); sm.phase = 'idle'; }

  function simonShow() {
    sm.phase = 'show';
    smMsg.textContent = `잘 들어보세요… (${sm.seq.length}음)`;
    sm.seq.forEach((id, i) => {
      sm.timers.push(setTimeout(() => api.pulseNote(id, 0.42), 350 + i * 520));
    });
    sm.timers.push(setTimeout(() => {
      sm.phase = 'input';
      sm.idx = 0;
      smMsg.textContent = '이제 따라 연주하세요!';
    }, 350 + sm.seq.length * 520 + 200));
  }

  function simonRound() {
    sm.seq.push(NOTE_IDS[rand(NOTE_IDS.length)]);
    smLevelEl.textContent = sm.seq.length;
    simonShow();
  }

  function simonInput(id) {
    if (sm.phase !== 'input') return;
    if (id === sm.seq[sm.idx]) {
      sm.idx++;
      if (sm.idx === sm.seq.length) {
        const level = sm.seq.length;
        if (level > sm.best) { sm.best = level; writeLS('oot-simon', sm.best); smBestEl.textContent = sm.best; }
        if (OOT.progress) OOT.progress.event('simon', { level });
        sm.phase = 'show';
        smMsg.textContent = `좋아요! 레벨 ${level} 통과 ✨`;
        sm.timers.push(setTimeout(simonRound, 800));
      }
    } else {
      sm.phase = 'over';
      const reached = sm.seq.length - 1;
      smMsg.textContent = `게임 오버 — 레벨 ${Math.max(0, reached)}까지 성공! 다시 도전해 보세요.`;
      smStart.textContent = '▶ 다시 시작';
    }
  }

  if (smStart) smStart.addEventListener('click', () => {
    stopGames();
    api.stopAll();
    api.synth.ensure();
    sm.seq = [];
    sm.phase = 'idle';
    smStart.textContent = '▶ 다시 시작';
    simonRound();
  });

  /* ------------------------------------------------------------- Wiring */
  api.onNote((id) => {
    const col = rgStage && rgStage.querySelector(`.rg-col[data-note="${id}"]`);
    if (col) col.classList.add('on');
    if (rg.on && rg.mode === 'zelda') {
      rg.held.add(id);
      rhythmHit(id);
    }
    simonInput(id);
  });
  api.onNoteEnd((id) => {
    if (rg.on && rg.mode === 'zelda') rhythmRelease(id);
    const col = rgStage && rgStage.querySelector(`.rg-col[data-note="${id}"]`);
    if (col) col.classList.remove('on');
  });
  if (FULL) {
    FULL.onNote((id) => {
      if (!rg.on || rg.mode !== 'full') return;
      rg.held.add(id);
      const col = rgStage && rgStage.querySelector('.rg-col-full');
      if (col) col.classList.add('on');
      rhythmHit(id);
    });
    FULL.onNoteEnd((id) => {
      if (rg.on && rg.mode === 'full') rhythmRelease(id);
      const col = rgStage && rgStage.querySelector('.rg-col-full');
      if (col) col.classList.remove('on');
    });
  }

  function stopGames() { rhythmStop(false); quizStop(); simonStop(); }
  document.addEventListener('oot:tab', stopGames);
  document.addEventListener('oot:stop', stopGames);
})();
