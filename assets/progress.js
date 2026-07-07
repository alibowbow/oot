/* ============================================================================
 * Ocarina of Time — progress: stats + achievements (localStorage)
 * All celebration here is visual only; nothing in this module makes sound.
 * ==========================================================================*/
(function () {
  'use strict';
  if (!window.OOT || !OOT.api) return;
  const { api, SONGS } = OOT;
  const $ = (s, r = document) => r.querySelector(s);

  const LS_STATS = 'oot-stats', LS_ACH = 'oot-ach';

  let stats = { notes: 0, quizBest: 0, simonBest: 0, comps: 0, scare: false, storms: false, suns: false, sGrades: 0 };
  try { Object.assign(stats, JSON.parse(localStorage.getItem(LS_STATS) || '{}')); } catch (e) { /* ignore */ }

  let unlocked = new Set();
  try { unlocked = new Set(JSON.parse(localStorage.getItem(LS_ACH) || '[]')); } catch (e) { /* ignore */ }

  const persist = () => {
    try {
      localStorage.setItem(LS_STATS, JSON.stringify(stats));
      localStorage.setItem(LS_ACH, JSON.stringify([...unlocked]));
    } catch (e) { /* file:// / private mode */ }
  };

  /* --------------------------------------------------------- Achievements */
  const ACH = [
    { id: 'note1',    icon: '🎵', ko: '첫 음',            en: 'First Note',        desc: '오카리나로 첫 음을 연주하기',              test: (s) => s.notes >= 1 },
    { id: 'note100',  icon: '💯', ko: '백 개의 음',       en: 'Hundred Notes',     desc: '음을 100번 연주하기',                     test: (s) => s.notes >= 100 },
    { id: 'note1000', icon: '🎼', ko: '천 번의 숨결',     en: 'Thousand Breaths',  desc: '음을 1,000번 연주하기',                   test: (s) => s.notes >= 1000 },
    { id: 'learn3',   icon: '📗', ko: '견습 음유시인',    en: 'Apprentice Bard',   desc: '노래 3곡 익히기',                          test: () => api.learnedCount() >= 3 },
    { id: 'learn12',  icon: '🏆', ko: '하이랄의 영웅',    en: 'Hero of Hyrule',    desc: '12곡을 모두 익히기',                       test: () => api.learnedCount() >= 12 },
    { id: 'comp1',    icon: '✍️', ko: '작곡가',           en: 'Composer',          desc: '작곡 스튜디오에서 노래 저장하기',          test: (s) => s.comps >= 1 },
    { id: 'scare',    icon: '🌾', ko: '허수아비의 친구',  en: "Scarecrow's Friend", desc: '허수아비의 노래(8음) 등록하기',           test: (s) => s.scare },
    { id: 'quiz5',    icon: '🧠', ko: '밝은 귀',          en: 'Keen Ears',         desc: '멜로디 퀴즈 5연속 정답',                   test: (s) => s.quizBest >= 5 },
    { id: 'simon10',  icon: '🔁', ko: '메아리의 달인',    en: 'Echo Master',       desc: '메아리 게임 레벨 10 도달',                 test: (s) => s.simonBest >= 10 },
    { id: 'srank',    icon: '⭐', ko: '리듬 스타',        en: 'Rhythm Star',       desc: '리듬 챌린지에서 S등급 받기',               test: (s) => s.sGrades >= 1 },
    { id: 'storm',    icon: '🌧️', ko: '폭풍을 부르는 자', en: 'Storm Caller',      desc: '자유 연주로 폭풍의 노래 인식시키기',       test: (s) => s.storms },
    { id: 'sun',      icon: '🌞', ko: '새벽을 여는 자',   en: 'Dawn Bringer',      desc: '자유 연주로 태양의 노래 인식시키기',       test: (s) => s.suns },
  ];

  const toastBox = $('#ach-toast');
  function toastAch(a) {
    if (!toastBox) return;
    const el = document.createElement('div');
    el.className = 'ach-pop';
    el.innerHTML = `<span class="a-icon">${a.icon}</span><span><b>도전과제 달성!</b><br>${a.ko} · ${a.en}</span>`;
    toastBox.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  function check() {
    let changed = false;
    ACH.forEach((a) => {
      if (!unlocked.has(a.id) && a.test(stats)) {
        unlocked.add(a.id);
        toastAch(a);
        changed = true;
      }
    });
    if (changed) { persist(); renderIfOpen(); }
  }

  /* ------------------------------------------------------------ Rendering */
  function renderStats() {
    const grid = $('#stat-grid');
    if (!grid) return;
    const rhythmBest = readRhythm();
    const sCount = Object.values(rhythmBest).filter((r) => r.grade === 'S').length;
    const tiles = [
      ['🎵', stats.notes.toLocaleString(), '연주한 음 Notes played'],
      ['📗', `${api.learnedCount()} / ${SONGS.length}`, '익힌 노래 Songs learned'],
      ['🧠', stats.quizBest, '퀴즈 최고 연속 Quiz streak'],
      ['🔁', stats.simonBest, '메아리 최고 레벨 Echo level'],
      ['⭐', sCount, '리듬 S등급 곡 S-rank songs'],
      ['✍️', stats.comps, '내 노래 Compositions'],
    ];
    grid.innerHTML = tiles.map(([ic, v, l]) =>
      `<div class="stat-tile"><span class="t-icon">${ic}</span><b>${v}</b><span class="t-label">${l}</span></div>`).join('');
  }

  function renderAch() {
    const grid = $('#ach-grid');
    if (!grid) return;
    grid.innerHTML = ACH.map((a) => {
      const on = unlocked.has(a.id);
      return `<div class="ach-card${on ? ' on' : ''}" title="${a.desc}">` +
        `<span class="a-icon">${a.icon}</span><b>${a.ko}</b><span class="a-en">${a.en}</span>` +
        `<span class="a-desc">${a.desc}</span></div>`;
    }).join('');
    const count = $('#ach-count');
    if (count) count.textContent = `${unlocked.size} / ${ACH.length}`;
  }

  function readRhythm() {
    try { return JSON.parse(localStorage.getItem('oot-rhythm') || '{}'); } catch (e) { return {}; }
  }

  let panelOpen = false;
  function renderIfOpen() { if (panelOpen) { renderStats(); renderAch(); } }
  function renderAll() { renderStats(); renderAch(); }

  document.addEventListener('oot:tab', (e) => {
    panelOpen = e.detail === 'progress';
    if (panelOpen) renderAll();
  });

  /* --------------------------------------------------------------- Wiring */
  let persistTimer = 0;
  api.onNote(() => {
    stats.notes++;
    const now = Date.now();
    if (now - persistTimer > 800) { persistTimer = now; persist(); }
    check();
    renderIfOpen();
  });

  api.onSong((ev) => {
    if (ev.type === 'song') {
      if (ev.song.id === 'storms') stats.storms = true;
      if (ev.song.id === 'suns') stats.suns = true;
    } else if (ev.type === 'scarecrow') {
      stats.scare = true;
    }
    persist(); check(); renderIfOpen();
  });

  // games / studio report their results here
  OOT.progress = {
    event(name, d = {}) {
      if (name === 'quiz') stats.quizBest = Math.max(stats.quizBest, d.streak || 0);
      else if (name === 'simon') stats.simonBest = Math.max(stats.simonBest, d.level || 0);
      else if (name === 'rhythm' && d.grade === 'S') stats.sGrades++;
      else if (name === 'comp') stats.comps = Math.max(stats.comps, d.count || 0);
      else if (name === 'scare') stats.scare = true;
      persist(); check(); renderIfOpen();
    },
    get: () => ({ ...stats }),
  };

  const resetBtn = $('#reset-progress');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (!window.confirm('통계·도전과제·배운 노래·게임 기록을 초기화할까요?\n(작곡한 노래와 허수아비의 노래는 유지됩니다)')) return;
    try {
      ['oot-stats', 'oot-ach', 'oot-learned', 'oot-quiz', 'oot-simon', 'oot-rhythm'].forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
    location.reload();
  });

  check();   // catch anything already satisfied (e.g. after an import)
})();
