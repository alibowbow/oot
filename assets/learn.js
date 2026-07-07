/* ============================================================================
 * Ocarina of Time — learn mode: a textbook-style, hands-on curriculum.
 * Renders OOT.CURRICULUM (chapters of read / tap / hold / seq / echo / quiz /
 * song steps) and gates progress on actually playing the instrument.
 * ==========================================================================*/
(function () {
  'use strict';
  if (!window.OOT || !OOT.api) return;
  const { api, NOTES, SONGS } = OOT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const CURRICULUM = (Array.isArray(OOT.CURRICULUM) ? OOT.CURRICULUM : [])
    .filter((c) => c && c.id && Array.isArray(c.steps) && c.steps.length);
  if (!CURRICULUM.length) return;

  const LS = 'oot-learn';
  let prog = { done: {}, step: {} };
  try { Object.assign(prog, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(prog)); } catch (e) { /* ignore */ } };

  const home = $('#learn-home'), lessonEl = $('#learn-lesson');
  const stepBody = $('#step-body'), feedback = $('#step-feedback');
  const prevBtn = $('#step-prev'), nextBtn = $('#step-next');

  const NAME = { A: '레(A)', down: '파(▼)', right: '라(▶)', left: '시(◀)', up: '높은 레(▲)' };
  const chip = (id) => `<span class="l-chip${id === 'A' ? ' a' : ''}" style="--c:${NOTES[id].color}">${NOTES[id].arrow}</span>`;

  /* ------------------------------------------------------------------ TOC */
  function doneCount() { return CURRICULUM.filter((c) => prog.done[c.id]).length; }

  function renderHome() {
    const list = $('#lesson-list');
    if (!list) return;
    const n = doneCount();
    const fill = $('#cp-fill'), txt = $('#cp-text');
    if (fill) fill.style.width = (n / CURRICULUM.length * 100) + '%';
    if (txt) txt.textContent = `${n} / ${CURRICULUM.length} 단원 완료`;

    list.innerHTML = '';
    CURRICULUM.forEach((c, i) => {
      const done = !!prog.done[c.id];
      const started = (prog.step[c.id] || 0) > 0;
      const el = document.createElement('article');
      el.className = 'lesson-card-toc' + (done ? ' done' : '');
      el.innerHTML =
        `<div class="lc-num">${done ? '✔' : i + 1}</div>` +
        `<div class="lc-body"><h3>${c.title} <span>${c.titleEn || ''}</span></h3>` +
        `<p>${c.intro || ''}</p>` +
        `<span class="lc-meta">${c.steps.length}단계 · 실습 ${c.steps.filter((s) => s.type !== 'read').length}개</span></div>` +
        `<button class="big-btn ${done ? '' : 'gold'}">${done ? '복습' : started ? '이어하기' : '시작'}</button>`;
      $('button', el).addEventListener('click', () => openLesson(i));
      list.appendChild(el);
    });
  }

  /* --------------------------------------------------------------- Lesson */
  let cur = null;            // { ch, idx }
  let stepDone = false;      // current step's exercise completed?
  let cleanup = null;        // per-step teardown (timers, highlights)

  function openLesson(i) {
    api.stopAll();
    cur = { ch: CURRICULUM[i], idx: Math.min(prog.step[CURRICULUM[i].id] || 0, CURRICULUM[i].steps.length - 1) };
    home.hidden = true;
    lessonEl.hidden = false;
    renderStep();
  }

  function exitLesson() {
    teardown();
    cur = null;
    lessonEl.hidden = true;
    home.hidden = false;
    api.stopAll();
    renderHome();
  }

  function teardown() {
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    clearGuides();
    setFeedback('');
  }

  function setFeedback(msg, good) {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.classList.toggle('good', !!good);
  }

  // guide highlight on both pads (same .expect visual practice mode uses)
  function guide(id) {
    clearGuides();
    if (id) $$(`.note-btn[data-note="${id}"]`).forEach((b) => b.classList.add('expect'));
  }
  function clearGuides() { $$('.note-btn.expect').forEach((b) => b.classList.remove('expect')); }

  function markStepDone(msg) {
    if (stepDone) return;
    stepDone = true;
    setFeedback(msg || '잘했어요! ✨ "다음"을 눌러 계속하세요.', true);
    nextBtn.disabled = false;
    nextBtn.classList.add('pulse');
  }

  /* ------------------------------------------------------------- Figures */
  function figHTML(fig) {
    if (!fig || !fig.kind) return '';
    if (fig.kind === 'staff' && Array.isArray(fig.notes)) {
      const notes = fig.notes.filter((n) => Array.isArray(n) && NOTES[n[0]]);
      if (!notes.length) return '';
      return `<figure class="l-fig">${api.staffSVG({ notes })}` +
        (fig.caption ? `<figcaption>${fig.caption}</figcaption>` : '') + `</figure>`;
    }
    if (fig.kind === 'pad') {
      return `<figure class="l-fig l-fig-pad"><div class="fig-pad">` +
        `<span class="fp up">▲</span><span class="fp left">◀</span><span class="fp right">▶</span>` +
        `<span class="fp down">▼</span><span class="fp a">A</span></div>` +
        (fig.caption ? `<figcaption>${fig.caption}</figcaption>` : '') + `</figure>`;
    }
    return '';
  }

  /* ---------------------------------------------------------- Step runner */
  function renderStep() {
    teardown();
    const { ch, idx } = cur;
    const step = ch.steps[idx];
    prog.step[ch.id] = idx;
    save();

    $('#lesson-title').textContent = ch.title;
    $('#lesson-step').textContent = ` · ${idx + 1} / ${ch.steps.length}`;
    const lp = $('#lp-fill');
    if (lp) lp.style.width = ((idx + 1) / ch.steps.length * 100) + '%';
    prevBtn.disabled = idx === 0;
    nextBtn.classList.remove('pulse');
    nextBtn.textContent = idx === ch.steps.length - 1 ? '단원 완료 🎉' : '다음 →';

    stepDone = step.type === 'read';           // reading needs no exercise
    nextBtn.disabled = !stepDone;

    const runner = RUNNERS[step.type] || RUNNERS.read;
    runner(step);
  }

  const RUNNERS = {
    /* 본문 읽기 */
    read(step) {
      stepBody.innerHTML =
        (step.title ? `<h4 class="step-title">${step.title}</h4>` : '') +
        `<div class="step-prose">${step.html || ''}</div>` + figHTML(step.fig);
    },

    /* 특정 음을 n번 연주 */
    tap(step) {
      const id = NOTES[step.note] ? step.note : 'A';
      const need = Math.max(1, step.times || 1);
      let got = 0;
      stepBody.innerHTML =
        `<p class="step-prompt">${step.prompt || ''}</p>` +
        `<div class="l-target">${chip(id)}<span class="l-count"><b id="tap-got">0</b> / ${need}</span></div>`;
      guide(id);
      const off = api.onNote((nid) => {
        if (stepDone) return;
        if (nid === id) {
          got++;
          const g = $('#tap-got'); if (g) g.textContent = got;
          setFeedback(got < need ? `좋아요! ${NAME[id]} — ${need - got}번 더!` : '', true);
          if (got >= need) { clearGuides(); markStepDone(); }
        } else {
          setFeedback(`그 음은 ${NAME[nid]}이에요. ${NAME[id]} 버튼을 찾아보세요!`);
        }
      });
      cleanup = off;
    },

    /* 길게 지속 */
    hold(step) {
      const id = NOTES[step.note] ? step.note : 'right';
      const ms = Math.max(300, step.ms || 1200);
      let t0 = 0;
      stepBody.innerHTML =
        `<p class="step-prompt">${step.prompt || ''}</p>` +
        `<div class="l-target">${chip(id)}<span class="l-count">${(ms / 1000).toFixed(1)}초 이상 길게</span></div>` +
        `<div class="hold-bar"><span id="hold-fill"></span></div>`;
      guide(id);
      let raf = 0;
      const fill = () => {
        const el = $('#hold-fill');
        if (el && t0) el.style.width = Math.min(100, (performance.now() - t0) / ms * 100) + '%';
        if (t0) raf = requestAnimationFrame(fill);
      };
      const offOn = api.onNote((nid) => {
        if (stepDone) return;
        if (nid === id) { t0 = performance.now(); setFeedback('그대로 누르고 계세요…'); raf = requestAnimationFrame(fill); }
        else setFeedback(`${NAME[id]} 버튼으로 해볼까요?`);
      });
      const offEnd = api.onNoteEnd((nid) => {
        if (stepDone || nid !== id || !t0) return;
        const held = performance.now() - t0;
        t0 = 0;
        cancelAnimationFrame(raf);
        if (held >= ms) { clearGuides(); markStepDone(`${(held / 1000).toFixed(1)}초! 멋진 장음이었어요. ✨`); }
        else setFeedback(`${(held / 1000).toFixed(1)}초 — 조금만 더 길게 불어볼까요?`);
      });
      cleanup = () => { offOn(); offEnd(); cancelAnimationFrame(raf); };
    },

    /* 순서대로 연주 (가이드 표시) */
    seq(step) {
      const ids = (step.ids || []).filter((i) => NOTES[i]);
      if (!ids.length) { RUNNERS.read(step); return; }
      let at = 0;
      stepBody.innerHTML =
        `<p class="step-prompt">${step.prompt || ''}</p>` +
        `<div class="l-seq">${ids.map((i, k) => `<span class="l-chip${i === 'A' ? ' a' : ''} seq-chip" data-k="${k}" style="--c:${NOTES[i].color}">${NOTES[i].arrow}</span>`).join('')}</div>`;
      const mark = () => $$('.seq-chip', stepBody).forEach((el, k) => {
        el.classList.toggle('done', k < at);
        el.classList.toggle('now', k === at);
      });
      mark(); guide(ids[0]);
      const off = api.onNote((nid) => {
        if (stepDone) return;
        if (nid === ids[at]) {
          at++;
          if (at >= ids.length) { mark(); clearGuides(); markStepDone(); }
          else { mark(); guide(ids[at]); setFeedback('', true); }
        } else {
          setFeedback(`다음 음은 ${NAME[ids[at]]}이에요 — 반짝이는 버튼을 보세요!`);
        }
      });
      cleanup = off;
    },

    /* 듣고 따라하기 */
    echo(step) {
      const ids = (step.ids || []).filter((i) => NOTES[i]);
      if (!ids.length) { RUNNERS.read(step); return; }
      let at = 0, phase = 'idle', timers = [];
      stepBody.innerHTML =
        `<p class="step-prompt">${step.prompt || ''}</p>` +
        `<div class="g-controls"><button id="echo-play" class="big-btn gold">🔊 들어보기</button>` +
        `<span class="l-count">${ids.length}음</span></div>`;
      const play = () => {
        timers.forEach(clearTimeout); timers = [];
        phase = 'show'; at = 0;
        setFeedback('잘 들어보세요…');
        ids.forEach((nid, k) => timers.push(setTimeout(() => api.pulseNote(nid, 0.42), 250 + k * 520)));
        timers.push(setTimeout(() => { phase = 'input'; setFeedback('이제 그대로 따라 연주해 보세요!'); }, 250 + ids.length * 520 + 150));
      };
      $('#echo-play', stepBody).addEventListener('click', play);
      const off = api.onNote((nid) => {
        if (stepDone || phase !== 'input') return;
        if (nid === ids[at]) {
          at++;
          if (at >= ids.length) markStepDone('완벽하게 따라 했어요! 👏');
        } else {
          phase = 'idle'; at = 0;
          setFeedback('괜찮아요! "들어보기"로 다시 듣고 도전해 보세요.');
        }
      });
      cleanup = () => { off(); timers.forEach(clearTimeout); };
    },

    /* 확인 문제 */
    quiz(step) {
      const choices = step.choices || [];
      stepBody.innerHTML =
        `<p class="step-prompt">${step.question || ''}</p>` +
        `<div class="qz-choices">${choices.map((c, k) =>
          `<button class="qz-choice" data-k="${k}">${c}</button>`).join('')}</div>`;
      $$('.qz-choice', stepBody).forEach((b) => b.addEventListener('click', () => {
        if (stepDone) return;
        const k = +b.dataset.k;
        if (k === step.answer) {
          b.classList.add('right');
          $$('.qz-choice', stepBody).forEach((x) => { x.disabled = true; });
          markStepDone(step.why ? `정답! ${step.why}` : '정답이에요! 🎉');
        } else {
          b.classList.add('wrong');
          b.disabled = true;
          setFeedback('음… 다시 한번 생각해 볼까요?');
        }
      }));
    },

    /* 곡 구간 듣고 따라 연주 */
    song(step) {
      const src = SONGS.find((s) => s.id === step.songId);
      if (!src) { RUNNERS.read(step); return; }
      const from = Math.max(0, step.from | 0);
      const to = Math.min(src.notes.length, step.to == null ? src.notes.length : step.to | 0);
      const phrase = src.notes.slice(from, to);
      const ids = phrase.map((n) => n[0]);
      if (!ids.length) { RUNNERS.read(step); return; }
      let at = 0;
      stepBody.innerHTML =
        `<p class="step-prompt">${step.prompt || ''}</p>` +
        figHTML({ kind: 'staff', notes: phrase, caption: `${src.name} · ${from + 1}~${to}번째 음 (♩=${src.bpm})` }) +
        `<div class="g-controls"><button id="phrase-play" class="big-btn gold">🔊 들어보기</button></div>` +
        `<div class="l-seq">${ids.map((i, k) => `<span class="l-chip${i === 'A' ? ' a' : ''} seq-chip" data-k="${k}" style="--c:${NOTES[i].color}">${NOTES[i].arrow}</span>`).join('')}</div>`;
      const mark = () => $$('.seq-chip', stepBody).forEach((el, k) => {
        el.classList.toggle('done', k < at);
        el.classList.toggle('now', k === at);
      });
      mark(); guide(ids[0]);
      $('#phrase-play', stepBody).addEventListener('click', () => {
        at = 0; mark(); guide(ids[0]);
        api.playSong({ notes: phrase, bpm: src.bpm }, null);
        setFeedback('박자를 느끼며 들어보세요 — 끝나면 따라 연주!');
      });
      const off = api.onNote((nid) => {
        if (stepDone) return;
        if (nid === ids[at]) {
          at++;
          if (at >= ids.length) { mark(); clearGuides(); markStepDone('구절 완주! 박자까지 살리면 금상첨화예요. 🎶'); }
          else { mark(); guide(ids[at]); }
        } else {
          setFeedback(`다음 음은 ${NAME[ids[at]]} — 악보의 ${at + 1}번째 음이에요.`);
        }
      });
      cleanup = off;
    },
  };

  /* ------------------------------------------------------------ Nav wiring */
  prevBtn.addEventListener('click', () => {
    if (!cur || cur.idx === 0) return;
    cur.idx--;
    renderStep();
  });
  nextBtn.addEventListener('click', () => {
    if (!cur || !stepDone) return;
    if (cur.idx >= cur.ch.steps.length - 1) {
      // chapter complete
      prog.done[cur.ch.id] = true;
      prog.step[cur.ch.id] = 0;
      save();
      if (!api.prefersReduce()) api.sparkles(10, '#f6c61f');
      if (OOT.progress) OOT.progress.event('learn', { done: doneCount(), total: CURRICULUM.length });
      exitLesson();
      return;
    }
    cur.idx++;
    renderStep();
  });
  $('#lesson-exit').addEventListener('click', exitLesson);

  // leaving the tab (or pressing Stop) tears the current exercise down
  document.addEventListener('oot:tab', (e) => { if (e.detail !== 'learn') teardown(); });
  document.addEventListener('oot:stop', teardown);

  renderHome();
})();
