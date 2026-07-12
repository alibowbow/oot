/* ============================================================================
 * Ocarina of Time — minigames: rhythm challenge, melody quiz, echo (Simon)
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
  const HIT_OFF = 14;                    // hit line sits this many px above the keys
  const CHIP_H = 22;                     // must match .rg-chip height
  const LANES = ['left', 'down', 'up', 'right', 'A'];   // bottom-key order
  const rgSel = $('#rg-song'), rgStart = $('#rg-start'), rgStop = $('#rg-stop');
  const rgField = $('#rg-field'), rgStage = $('#rg-stage'), rgResult = $('#rg-result');
  const rgScoreEl = $('#rg-score'), rgComboEl = $('#rg-combo'), rgJudgeEl = $('#rg-judge'), rgBestEl = $('#rg-best');

  let rg = { on: false, chips: [], raf: 0 };
  let rhythmBest = readLS('oot-rhythm', {});
  const rgCols = {};                     // note id → that lane's .rg-notes box

  // Build the five beatmania-style lanes: falling-note box + a key underneath.
  // The keys are real instrument buttons (hold to sustain), so the game is
  // played right on the field — keyboard arrows / A still work as before.
  if (rgStage) {
    LANES.forEach((id, i) => {
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
    // light the whole lane while its note sounds, whatever the input source
    api.onNote((id) => { const c = rgStage.querySelector(`.rg-col[data-note="${id}"]`); if (c) c.classList.add('on'); });
    api.onNoteEnd((id) => { const c = rgStage.querySelector(`.rg-col[data-note="${id}"]`); if (c) c.classList.remove('on'); });
  }

  if (rgSel) {
    rgSel.innerHTML = SONGS.map((s) => `<option value="${s.id}">${s.name} · ${s.nameKo}</option>`).join('');
    rgSel.addEventListener('change', showRgBest);
    showRgBest();
  }
  function showRgBest() {
    if (!rgBestEl || !rgSel) return;
    const b = rhythmBest[rgSel.value];
    rgBestEl.textContent = b ? `최고 ${b.score}점 · ${b.grade}` : '기록 없음';
  }

  function rhythmStart() {
    stopGames();
    api.stopAll();
    const song = SONGS.find((s) => s.id === rgSel.value) || SONGS[0];
    rgField.hidden = false; rgResult.hidden = true;
    rgField.classList.remove('open');
    void rgField.offsetWidth;              // restart the open animation
    rgField.classList.add('open');
    rgStart.hidden = true; rgStop.hidden = false;
    rgScoreEl.textContent = '0'; rgComboEl.textContent = '';
    rgJudgeEl.textContent = '♪ 준비…'; rgJudgeEl.className = 'rg-pop hold';

    rg = { on: true, song, chips: [], raf: 0, score: 0, combo: 0, maxCombo: 0, counts: { P: 0, G: 0, M: 0 }, judged: 0 };
    const beatMs = 60000 / song.bpm;
    const t0 = performance.now() + 800 + APPROACH;   // lead-in before the first hit
    let acc = 0;
    song.notes.forEach(([id, beats]) => {
      const el = document.createElement('span');
      el.className = 'rg-chip' + (id === 'A' ? ' a' : '');
      el.textContent = NOTES[id].arrow;
      rgCols[id].appendChild(el);
      rg.chips.push({ id, el, tHit: t0 + acc * beatMs, judged: false });
      acc += beats;
    });
    rgField.scrollIntoView({ behavior: api.prefersReduce() ? 'auto' : 'smooth', block: 'center' });
    rg.raf = requestAnimationFrame(rhythmFrame);
  }

  function rhythmFrame() {
    if (!rg.on) return;
    const now = performance.now();
    const laneH = rgCols[LANES[0]].clientHeight || 420;
    const hitY = laneH - HIT_OFF;          // where a chip's center lands at tHit
    rg.chips.forEach((c) => {
      if (c.judged) return;
      const y = hitY - ((c.tHit - now) / APPROACH) * (hitY + CHIP_H);
      c.el.style.transform = `translateY(${y}px)`;
      if (now - c.tHit > 220) judge(c, 'M');
    });
    if (rg.judged >= rg.chips.length) { rhythmEnd(); return; }
    rg.raf = requestAnimationFrame(rhythmFrame);
  }

  function rhythmHit(id) {
    if (!rg.on) return;
    const now = performance.now();
    let best = null;
    rg.chips.forEach((c) => {
      if (c.judged || c.id !== id) return;
      const dt = Math.abs(now - c.tHit);
      if (dt <= 220 && (!best || dt < best.dt)) best = { c, dt };
    });
    if (best) judge(best.c, best.dt <= 90 ? 'P' : 'G');
  }

  const JUDGE_TXT = { P: 'PERFECT!', G: 'GOOD', M: 'MISS' };
  function judge(c, k) {
    c.judged = true;
    rg.judged++;
    rg.counts[k]++;
    if (k === 'M') { rg.combo = 0; c.el.classList.add('m'); }
    else {
      rg.score += k === 'P' ? 100 : 60;
      rg.combo++;
      rg.maxCombo = Math.max(rg.maxCombo, rg.combo);
      c.el.classList.add(k === 'P' ? 'p' : 'g');
    }
    rgScoreEl.textContent = rg.score;
    rgComboEl.textContent = rg.combo > 1 ? `콤보 ×${rg.combo}` : '';
    // center flash, beatmania style — retrigger the pop animation each judgment
    rgJudgeEl.textContent = JUDGE_TXT[k] + (k !== 'M' && rg.combo > 1 ? ` ×${rg.combo}` : '');
    rgJudgeEl.className = 'rg-pop j-' + k.toLowerCase();
    void rgJudgeEl.offsetWidth;
    rgJudgeEl.classList.add('pop');
  }

  function rhythmEnd() {
    const max = rg.chips.length * 100;
    const pct = max ? rg.score / max : 0;
    const grade = pct >= 0.95 ? 'S' : pct >= 0.8 ? 'A' : pct >= 0.6 ? 'B' : 'C';
    const prev = rhythmBest[rg.song.id];
    if (!prev || rg.score > prev.score) {
      rhythmBest[rg.song.id] = { score: rg.score, grade };
      writeLS('oot-rhythm', rhythmBest);
    }
    rgResult.hidden = false;
    rgResult.innerHTML =
      `<b class="grade g-${grade.toLowerCase()}">${grade}</b>` +
      `<span>점수 <b>${rg.score}</b> / ${max} · 최대 콤보 ×${rg.maxCombo}</span>` +
      `<span class="counts">Perfect ${rg.counts.P} · Good ${rg.counts.G} · Miss ${rg.counts.M}</span>`;
    if (OOT.progress) OOT.progress.event('rhythm', { songId: rg.song.id, score: rg.score, grade });
    rhythmStop(true);
    showRgBest();
  }

  function rhythmStop(keepResult) {
    if (rg.raf) cancelAnimationFrame(rg.raf);
    rg.on = false;
    rg.raf = 0;
    if (rgField) {
      rgField.querySelectorAll('.rg-chip').forEach((el) => el.remove());
      rgField.hidden = true;
      rgField.classList.remove('open');
    }
    if (!keepResult && rgResult) rgResult.hidden = true;
    if (rgStart) rgStart.hidden = false;
    if (rgStop) rgStop.hidden = true;
  }

  if (rgStart) rgStart.addEventListener('click', rhythmStart);
  if (rgStop) rgStop.addEventListener('click', () => rhythmStop(false));

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
  api.onNote((id) => { rhythmHit(id); simonInput(id); });

  function stopGames() { rhythmStop(false); quizStop(); simonStop(); }
  document.addEventListener('oot:tab', stopGames);
  document.addEventListener('oot:stop', stopGames);
})();
