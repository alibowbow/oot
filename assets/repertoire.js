/* ============================================================================
 * Ocarina of Time — 세계의 연주곡집 (repertoire for the full-range mode)
 * ----------------------------------------------------------------------------
 * Public-domain / traditional melodies playable on a 12-hole alto C ocarina
 * (A4–F6), written as [noteId, beats] with quarter note = 1. Each entry names
 * its origin and why it is free to play. Melodies were cross-checked against
 * published letter-note / tab transcriptions.
 *
 * Cards offer ▶ listen (auto-play with chip + key highlight) and ✎ practice
 * (the next key glows on the repertoire keyboard; finish a song to earn its
 * seal). Progress persists in localStorage as 'oot-rep'.
 * ==========================================================================*/
(function () {
  'use strict';
  if (!window.OOT || !OOT.full) return;
  const F = OOT.full;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  /* ------------------------------------------------------------- The songs */
  // stars: 1 = first pieces, 4 = recital material
  const RSONGS = [
    {
      id: 'mary', nameKo: '비행기 (떴다 떴다)', name: 'Mary Had a Little Lamb', stars: 1, bpm: 100, key: 'C장조',
      origin: '미국 전래 동요 (1868) — 한국에서는 "비행기"로 불립니다 · 퍼블릭 도메인',
      notes: [['E5',1],['D5',1],['C5',1],['D5',1],['E5',1],['E5',1],['E5',2],
              ['D5',1],['D5',1],['D5',2],['E5',1],['G5',1],['G5',2],
              ['E5',1],['D5',1],['C5',1],['D5',1],['E5',1],['E5',1],['E5',1],['E5',1],
              ['D5',1],['D5',1],['E5',1],['D5',1],['C5',4]],
    },
    {
      id: 'twinkle', nameKo: '반짝반짝 작은 별', name: 'Twinkle Twinkle Little Star', stars: 1, bpm: 96, key: 'C장조',
      origin: '프랑스 전래 선율 "아! 어머니께 말씀드리죠" (1761) · 퍼블릭 도메인',
      notes: [['C5',1],['C5',1],['G5',1],['G5',1],['A5',1],['A5',1],['G5',2],
              ['F5',1],['F5',1],['E5',1],['E5',1],['D5',1],['D5',1],['C5',2],
              ['G5',1],['G5',1],['F5',1],['F5',1],['E5',1],['E5',1],['D5',2],
              ['G5',1],['G5',1],['F5',1],['F5',1],['E5',1],['E5',1],['D5',2],
              ['C5',1],['C5',1],['G5',1],['G5',1],['A5',1],['A5',1],['G5',2],
              ['F5',1],['F5',1],['E5',1],['E5',1],['D5',1],['D5',1],['C5',2]],
    },
    {
      id: 'odetojoy', nameKo: '환희의 송가', name: 'Ode to Joy — Beethoven', stars: 2, bpm: 116, key: 'C장조',
      origin: '베토벤 교향곡 9번 (1824) 합창 주제 · 퍼블릭 도메인',
      notes: [['E5',1],['E5',1],['F5',1],['G5',1],['G5',1],['F5',1],['E5',1],['D5',1],
              ['C5',1],['C5',1],['D5',1],['E5',1],['E5',1.5],['D5',0.5],['D5',2],
              ['E5',1],['E5',1],['F5',1],['G5',1],['G5',1],['F5',1],['E5',1],['D5',1],
              ['C5',1],['C5',1],['D5',1],['E5',1],['D5',1.5],['C5',0.5],['C5',2],
              ['D5',1],['D5',1],['E5',1],['C5',1],['D5',1],['E5',0.5],['F5',0.5],['E5',1],['C5',1],
              ['D5',1],['E5',0.5],['F5',0.5],['E5',1],['D5',1],['C5',1],['D5',1],['G5',2],
              ['E5',1],['E5',1],['F5',1],['G5',1],['G5',1],['F5',1],['E5',1],['D5',1],
              ['C5',1],['C5',1],['D5',1],['E5',1],['D5',1.5],['C5',0.5],['C5',2]],
    },
    {
      id: 'canon', nameKo: '캐논 주제 — 파헬벨', name: 'Canon in D (theme)', stars: 1, bpm: 72, key: 'G장조 편곡',
      origin: '요한 파헬벨 (1680년경) 제1바이올린 주제 · 퍼블릭 도메인 — 모든 음이 2박, 롱톤 연습에 최적',
      notes: [['B5',2],['A5',2],['G5',2],['F#5',2],['E5',2],['D5',2],['E5',2],['F#5',2],
              ['G5',2],['F#5',2],['E5',2],['D5',2],['C5',2],['B4',2],['C5',2],['A4',2]],
    },
    {
      id: 'auldlang', nameKo: '석별의 정 (올드 랭 사인)', name: 'Auld Lang Syne', stars: 2, bpm: 84, key: 'F장조',
      origin: '스코틀랜드 민요 · 로버트 번스 가사 (1788) · 퍼블릭 도메인',
      notes: [['C5',1],['F5',1.5],['F5',0.5],['F5',1],['A5',1],['G5',1.5],['F5',0.5],['G5',1],['A5',1],
              ['F5',1.5],['F5',0.5],['A5',1],['C6',1],['D6',3],
              ['D6',1],['C6',1.5],['A5',0.5],['A5',1],['F5',1],['G5',1.5],['F5',0.5],['G5',1],['A5',1],
              ['F5',1.5],['D5',0.5],['D5',1],['C5',1],['F5',3]],
    },
    {
      id: 'grace', nameKo: '어메이징 그레이스', name: 'Amazing Grace', stars: 2, bpm: 66, key: 'F장조',
      origin: '미국 전래 찬송 선율 "New Britain" (1829) · 존 뉴턴 가사 (1779) · 퍼블릭 도메인',
      notes: [['C5',1],['F5',2],['A5',0.5],['F5',0.5],['A5',2],['G5',1],['F5',2],['D5',1],['C5',2],
              ['C5',1],['F5',2],['A5',0.5],['F5',0.5],['A5',2],['G5',1],['C6',5],
              ['A5',1],['C6',2],['A5',1],['F5',2],['C5',1],['D5',2],['F5',1],['F5',2],
              ['C5',1],['F5',2],['A5',0.5],['F5',0.5],['A5',2],['G5',1],['F5',3]],
    },
    {
      id: 'susanna', nameKo: '오! 수재너', name: 'Oh! Susanna — S. Foster', stars: 2, bpm: 104, key: 'C장조',
      origin: '스티븐 포스터 (1848, 작곡가 1864년 작고) · 퍼블릭 도메인',
      notes: [['C5',0.5],['D5',0.5],['E5',1],['G5',1],['G5',1.5],['A5',0.5],['G5',1],['E5',1],
              ['C5',1.5],['D5',0.5],['E5',1],['E5',1],['D5',1],['C5',1],['D5',3],
              ['C5',0.5],['D5',0.5],['E5',1],['G5',1],['G5',1.5],['A5',0.5],['G5',1],['E5',1],
              ['C5',1.5],['D5',0.5],['E5',1],['E5',1],['D5',1],['D5',1],['C5',3],
              ['F5',2],['F5',2],['A5',2],['A5',1],['A5',1],['G5',1],['G5',1],['E5',1],['C5',1],['D5',3],
              ['C5',0.5],['D5',0.5],['E5',1],['G5',1],['G5',1.5],['A5',0.5],['G5',1],['E5',1],
              ['C5',1.5],['D5',0.5],['E5',1],['E5',1],['D5',1],['D5',1],['C5',3]],
    },
    {
      id: 'arirang', nameKo: '아리랑', name: 'Arirang', stars: 3, bpm: 70, key: 'G장조 (솔 시작)',
      origin: '한국 전래 민요 (경기아리랑) · 유네스코 인류무형문화유산 · 퍼블릭 도메인',
      notes: [['D5',1.5],['E5',0.5],['D5',0.5],['E5',0.5],['G5',1.5],['A5',0.5],['G5',0.5],['A5',0.5],
              ['B5',1],['A5',0.5],['B5',0.5],['G5',1],['E5',1.5],['D5',1.5],
              ['G5',1.5],['A5',0.5],['G5',0.5],['A5',0.5],['B5',1],['A5',0.5],['G5',0.5],['E5',1],
              ['D5',1.5],['E5',0.5],['G5',0.5],['A5',0.5],['G5',2],['G5',1],
              ['D6',1.5],['D6',0.5],['D6',1],['B5',1],['A5',0.5],['B5',0.5],['A5',0.5],['B5',0.5],['G5',1],
              ['E5',1],['D5',1],['D5',3],
              ['G5',1.5],['A5',0.5],['G5',0.5],['A5',0.5],['B5',1],['A5',0.5],['G5',0.5],['E5',1],
              ['D5',1.5],['E5',0.5],['G5',0.5],['A5',0.5],['G5',2],['G5',1]],
    },
    {
      id: 'doraji', nameKo: '도라지타령', name: 'Doraji Taryeong', stars: 3, bpm: 100, key: 'F장조 5음계 (한 옥타브 위)',
      origin: '한국 전래 민요 (황해도 은율 지방) · 퍼블릭 도메인',
      notes: [['A5',1],['A5',1],['A5',1],['A5',1.5],['G5',0.5],['F5',1],['C6',2],['D6',0.5],['C6',0.5],
              ['A5',1.5],['G5',0.5],['F5',1],['G5',0.5],['A5',0.5],['A5',2],
              ['G5',0.5],['A5',0.5],['G5',0.5],['F5',0.5],['D5',0.5],['C5',0.5],['D5',1],['F5',1],['D5',1],['C5',3],
              ['A5',1],['A5',2],['A5',1],['A5',1],['G5',0.5],['A5',0.5],['C6',2],['D6',0.5],['C6',0.5],
              ['A5',1.5],['G5',0.5],['F5',1],['G5',0.5],['A5',0.5],['A5',0.5],['A5',0.5],
              ['A5',1],['G5',0.5],['A5',0.5],['G5',0.5],['F5',0.5],['D5',0.5],['C5',0.5],['D5',1],['F5',1],['D5',1],['C5',3]],
    },
    {
      id: 'bom', nameKo: '고향의 봄', name: 'Spring of My Hometown — 홍난파', stars: 3, bpm: 92, key: 'C장조',
      origin: '홍난파 작곡 (1929, 작곡가 1941년 작고 — 선율 저작권 만료) · 이원수 시',
      notes: [['E5',1.5],['E5',0.5],['F5',1],['G5',1],['A5',1.5],['A5',0.5],['G5',2],
              ['C6',1.5],['C6',0.5],['A5',1],['G5',1],['E5',4],
              ['E5',1.5],['E5',0.5],['F5',1],['G5',1],['A5',1.5],['A5',0.5],['G5',2],
              ['G5',1.5],['E5',0.5],['D5',1],['E5',1],['D5',4],
              ['G5',1.5],['G5',0.5],['A5',1],['G5',1],['C6',1.5],['A5',0.5],['G5',2],
              ['E5',1.5],['E5',0.5],['G5',1],['A5',1],['G5',4],
              ['E5',1.5],['E5',0.5],['F5',1],['G5',1],['C6',1.5],['C6',0.5],['A5',1],['G5',1],
              ['G5',1.5],['E5',0.5],['D5',1],['D5',1],['C5',4]],
    },
    {
      id: 'swanee', nameKo: '스와니 강', name: 'Old Folks at Home — S. Foster', stars: 2, bpm: 80, key: 'C장조',
      origin: '스티븐 포스터 (1851) · 퍼블릭 도메인',
      notes: [['E5',2],['D5',0.5],['C5',0.5],['E5',0.5],['D5',0.5],['C5',1],['C6',1],['A5',0.5],['C6',1.5],
              ['G5',2],['E5',1],['C5',1],['D5',4],
              ['E5',2],['D5',0.5],['C5',0.5],['E5',0.5],['D5',0.5],['C5',1],['C6',1],['A5',0.5],['C6',1.5],
              ['G5',2],['E5',1],['C5',1],['D5',1],['D5',1],['C5',2],
              ['B5',1.5],['C6',0.5],['D6',1],['G5',1],['G5',1.5],['A5',0.5],['G5',1],
              ['C6',1],['C6',1],['A5',1],['F5',1],['A5',1],['G5',4],
              ['E5',2],['D5',0.5],['C5',0.5],['E5',0.5],['D5',0.5],['C5',1],['C6',1],['A5',0.5],['C6',1.5],
              ['G5',2],['E5',0.75],['C5',0.25],['D5',1],['D5',0.75],['D5',0.25],['C5',4]],
    },
    {
      id: 'sakura', nameKo: '사쿠라 사쿠라', name: 'Sakura Sakura', stars: 3, bpm: 84, key: 'E 미야코부시 (한 옥타브 위)',
      origin: '일본 에도시대 전래 선율 (1888 도쿄음악학교 채보) · 퍼블릭 도메인',
      notes: [['A5',1],['A5',1],['B5',2],['A5',1],['A5',1],['B5',2],
              ['A5',1],['B5',1],['C6',1],['B5',1],['A5',1],['B5',0.5],['A5',0.5],['F5',2],
              ['E5',1],['C5',1],['E5',1],['F5',1],['E5',1],['E5',0.5],['C5',0.5],['B4',2],
              ['A5',1],['B5',1],['C6',1],['B5',1],['A5',1],['B5',0.5],['A5',0.5],['F5',2],
              ['E5',1],['C5',1],['E5',1],['F5',1],['E5',1],['E5',0.5],['C5',0.5],['B4',2],
              ['A5',1],['A5',1],['B5',2],['A5',1],['A5',1],['B5',2],
              ['E5',1],['F5',1],['B5',0.5],['A5',0.5],['F5',1],['E5',3]],
    },
    {
      id: 'scarborough', nameKo: '스카버러 페어', name: 'Scarborough Fair', stars: 3, bpm: 88, key: 'D 도리아',
      origin: '영국 전래 발라드 (차일드 발라드 2번 계열) · 퍼블릭 도메인',
      notes: [['D5',2],['D5',1],['A5',2],['A5',1],['E5',1],['F5',1],['E5',1],['D5',3],
              ['A5',2],['C6',1],['D6',2],['C6',1],['A5',1],['B5',1],['G5',1],['A5',3],
              ['D6',2],['D6',1],['D6',2],['C6',1],['A5',1],['A5',1],['G5',1],['F5',1],['E5',2],
              ['D5',2],['A5',1],['G5',2],['F5',1],['E5',1],['D5',1],['C5',1],['D5',3]],
    },
    {
      id: 'greensleeves', nameKo: '그린슬리브즈', name: 'Greensleeves', stars: 4, bpm: 76, key: 'D단조 편곡',
      origin: '영국 전래 (1580년 등기) · 퍼블릭 도메인 — 반음(도♯·라♯)이 나오는 첫 곡, 검은 건반을 만나 보세요',
      notes: [['D5',0.5],['F5',1],['G5',0.5],['A5',0.5],['A#5',0.5],['A5',0.5],['G5',1],['E5',0.5],['C5',0.5],
              ['D5',0.5],['E5',0.5],['F5',1],['D5',0.5],['D5',0.5],['C#5',0.5],['D5',0.5],['E5',1],['C#5',0.5],['A4',1],
              ['D5',0.5],['F5',1],['G5',0.5],['A5',0.5],['A#5',0.5],['A5',0.5],['G5',1],['E5',0.5],['C5',0.5],
              ['D5',0.5],['E5',0.5],['F5',0.5],['E5',0.5],['D5',0.5],['C#5',0.5],['B4',0.5],['C#5',0.5],['D5',3]],
    },
  ];

  // Shared with the full-range Rhythm Challenge. Keeping one canonical song
  // list means repertoire playback, practice, and the game always agree on
  // notes, tempo, titles, and difficulty metadata.
  OOT.REPERTOIRE = RSONGS;

  /* ----------------------------------------------------------- Rendering */
  // No keyboard of its own: listening and practice drive the instrument's
  // main keyboard at the top of the page, switching to full mode as needed.
  const list = $('#rep-list'), mainKb = $('#full-kb');
  const listenPanel = $('#rep-listen'), listenWheel = $('#rep-song-wheel');
  const listenTitle = $('#rep-listen-title'), listenMeta = $('#rep-listen-meta');
  const listenPlay = $('#rep-listen-play'), listenStopBtn = $('#rep-listen-stop');
  const listenStatus = $('#rep-listen-status');
  const WHEEL_ITEM_H = 20;
  const LISTEN_SETTLE_MS = 420;
  const WHEEL_GESTURE_DELTA = 28;
  const WHEEL_GESTURE_IDLE_MS = 140;
  const now = () => (window.performance && typeof performance.now === 'function' ? performance.now() : Date.now());
  if (!list) return;

  function ensureFullMode(listening = false) {
    const fullOn = document.body.classList.contains('full-on');
    const listenOn = document.body.classList.contains('listen-on');
    if (!fullOn || listenOn !== listening) F.setMode(true, { listen: listening });
  }

  const storedRep = readLS('oot-rep', []);
  let learned = new Set(Array.isArray(storedRep) ? storedRep : []);
  let playTimers = [];
  let prac = null;                       // { songId, at, off }
  const listen = {
    index: 0, timers: [], restartTimer: 0, scrollTimer: 0, run: 0,
    wheelResetTimer: 0, wheelDelta: 0, wheelGestureMoved: false,
    session: false, playing: false, suppressScrollUntil: 0,
  };

  function stopPlayback() {
    playTimers.forEach(clearTimeout);
    playTimers = [];
    if (F.stopPreview) F.stopPreview();
    $$('.rc-note.now', list).forEach((el) => el.classList.remove('now'));
    $$('.rep-card .rplay-btn', list).forEach((b) => { b.textContent = '▶ 듣기'; });
  }

  function stopPractice(msg) {
    if (!prac) return;
    if (prac.off) prac.off();
    guideKey(null);
    const card = cardOf(prac.songId);
    if (card) {
      $$('.rc-note', card).forEach((el) => el.classList.remove('now', 'done'));
      const st = $('.rep-status', card);
      if (st) st.textContent = msg || '';
      const pb = $('.prac-btn', card);
      if (pb) pb.textContent = '✎ 연습';
    }
    prac = null;
  }

  const cardOf = (id) => list.querySelector(`.rep-card[data-song="${id}"]`);

  /* ---------------------------------------------------- Title-wheel listen */
  function updateListenControls() {
    if (listenPlay) listenPlay.textContent = listen.session ? '↻ 이 곡 다시 듣기' : '▶ 감상 시작';
    if (listenStopBtn) listenStopBtn.hidden = !listen.session;
  }

  function clearListenPlayback(keepSession = false) {
    listen.run++;
    listen.timers.forEach(clearTimeout);
    listen.timers = [];
    clearTimeout(listen.restartTimer);
    clearTimeout(listen.scrollTimer);
    listen.restartTimer = 0;
    listen.scrollTimer = 0;
    listen.playing = false;
    if (!keepSession) listen.session = false;
    if (F.stopPreview) F.stopPreview();
    updateListenControls();
  }

  function stopListen(message = '곡명을 돌려 선택하세요.') {
    clearListenPlayback(false);
    clearTimeout(listen.wheelResetTimer);
    listen.wheelResetTimer = 0;
    listen.wheelDelta = 0;
    listen.wheelGestureMoved = false;
    if (listenStatus) listenStatus.textContent = message;
  }

  function selectedListenSong() { return RSONGS[listen.index] || null; }

  function listenIndexAtCenter() {
    if (!listenWheel) return listen.index;
    /* jsdom has no layout metrics, so keep the deterministic step fallback
       used by the smoke tests. Browsers use the actual enlarged centre row. */
    if (!listenWheel.clientHeight) return Math.round(listenWheel.scrollTop / WHEEL_ITEM_H);
    const viewportCenter = listenWheel.scrollTop + (listenWheel.clientHeight / 2);
    let closest = listen.index;
    let distance = Infinity;
    $$('.rg-wheel-item', listenWheel).forEach((item) => {
      const itemCenter = item.offsetTop + (item.offsetHeight / 2);
      const nextDistance = Math.abs(itemCenter - viewportCenter);
      if (nextDistance < distance) {
        closest = Number(item.dataset.index);
        distance = nextDistance;
      }
    });
    return closest;
  }

  function setListenSelection(index, options = {}) {
    if (!RSONGS.length) return;
    const next = Math.max(0, Math.min(RSONGS.length - 1, index));
    const changed = next !== listen.index;
    listen.index = next;
    const song = selectedListenSong();
    if (!song) return;

    const items = listenWheel ? $$('.rg-wheel-item', listenWheel) : [];
    items.forEach((item, i) => {
      const selected = i === listen.index;
      item.classList.toggle('on', selected);
      item.classList.toggle('wheel-before', i < listen.index);
      item.classList.toggle('wheel-after', i > listen.index);
      item.setAttribute('aria-selected', String(selected));
    });
    if (listenWheel) listenWheel.setAttribute('aria-activedescendant', `rep-wheel-${song.id}`);
    if (listenTitle) listenTitle.textContent = song.nameKo;
    if (listenMeta) listenMeta.textContent = `${song.name} · ♩=${song.bpm} · ${song.key} · ${listen.index + 1}/${RSONGS.length}`;

    if (options.scroll && listenWheel) {
      listen.suppressScrollUntil = now() + 220;
      const top = listen.index * WHEEL_ITEM_H;
      if (typeof listenWheel.scrollTo === 'function') listenWheel.scrollTo({ top, behavior: 'auto' });
      else listenWheel.scrollTop = top;
    }

    if (changed && options.user) {
      clearListenPlayback(true);
      listen.session = true;
      if (listenStatus) listenStatus.textContent = `“${song.nameKo}” 선택 중…`;
      listen.restartTimer = setTimeout(playListenCurrent, LISTEN_SETTLE_MS);
    } else if (!listen.playing && listenStatus) {
      listenStatus.textContent = listen.session
        ? '제목을 돌리면 선택한 곡이 바로 재생됩니다.'
        : '감상 시작을 누르면 이후부터 제목을 돌릴 때 자동 재생됩니다.';
    }
  }

  function renderListenWheel() {
    if (!listenWheel || !RSONGS.length) return;
    listenWheel.innerHTML = RSONGS.map((song, i) =>
      `<button id="rep-wheel-${song.id}" class="rg-wheel-item" type="button" role="option" tabindex="-1" ` +
      `data-index="${i}" data-track="${String(i + 1).padStart(2, '0')}" aria-selected="false" ` +
      `title="${song.nameKo} · ${song.name}"><span>${song.nameKo}</span></button>`
    ).join('');
    $$('.rg-wheel-item', listenWheel).forEach((item) => {
      item.addEventListener('click', () => {
        const index = Number(item.dataset.index);
        if (index === listen.index) playListenCurrent();
        else setListenSelection(index, { scroll: true, user: true });
      });
    });
    setListenSelection(0, { scroll: true });
  }

  function playListenCurrent() {
    const song = selectedListenSong();
    if (!song || !F.startPreview) return;
    ensureFullMode(true);
    stopPlayback();
    stopPractice();
    clearListenPlayback(true);
    listen.session = true;
    listen.playing = true;
    const run = listen.run;
    updateListenControls();
    if (OOT.api && OOT.api.synth) OOT.api.synth.ensure();
    if (listenStatus) listenStatus.textContent = `재생 중 · ${song.nameKo}`;

    const beatMs = 60000 / song.bpm;
    let t = 140;
    song.notes.forEach(([id, beats], k) => {
      const duration = Math.max(180, beats * beatMs * .9);
      listen.timers.push(setTimeout(() => {
        if (!listen.session || listen.run !== run) return;
        F.stopPreview();
        F.startPreview(id);
        if (listenStatus) listenStatus.textContent = `재생 중 · ${song.nameKo} · ${k + 1}/${song.notes.length}`;
      }, t));
      listen.timers.push(setTimeout(() => {
        if (listen.run === run) F.endPreview(id);
      }, t + duration));
      t += beats * beatMs;
    });
    listen.timers.push(setTimeout(() => {
      if (listen.run !== run) return;
      F.stopPreview();
      listen.timers = [];
      listen.playing = false;
      updateListenControls();
      if (listenStatus) listenStatus.textContent = '감상이 끝났습니다. 제목을 돌리면 다음 곡이 바로 재생됩니다.';
    }, t + 120));
  }

  function stopAllRep() { stopPlayback(); stopPractice(); stopListen(); }

  // the practice guide glows on the instrument's main keyboard
  function guideKey(id) {
    if (!mainKb) return;
    $$('[data-note].expect', mainKb).forEach((el) => el.classList.remove('expect'));
    if (id) $$(`[data-note="${CSS.escape(id)}"]`, mainKb).forEach((el) => el.classList.add('expect'));
  }

  function chipRow(song) {
    return `<div class="rc-tabs">` + song.notes.map(([id, beats], k) => {
      const n = F.NOTES[id];
      return `<span class="rc-note${n.sharp ? ' sharp' : ''}${beats >= 2 ? ' long' : ''}" data-k="${k}" title="${id}">${n.label}</span>`;
    }).join('') + `</div>`;
  }

  function render() {
    list.innerHTML = '';
    RSONGS.forEach((song) => {
      const card = document.createElement('article');
      card.className = 'rep-card';
      card.dataset.song = song.id;
      card.innerHTML =
        `<header><div><h3>${song.nameKo}<span class="rc-en">${song.name}</span></h3></div>` +
        `<div class="rc-meta"><span class="rc-stars">${'★'.repeat(song.stars)}${'☆'.repeat(4 - song.stars)}</span><br>♩=${song.bpm} · ${song.key}</div></header>` +
        `<p class="rc-origin">${song.origin}</p>` +
        chipRow(song) +
        `<div class="actions"><button class="rplay-btn big-btn">▶ 듣기</button>` +
        `<button class="prac-btn big-btn gold">✎ 연습</button></div>` +
        `<p class="rep-status" role="status"></p>` +
        (learned.has(song.id) ? `<span class="learned-seal" title="연습 완주">✔</span>` : '');
      $('.rplay-btn', card).addEventListener('click', () => togglePlay(song, card));
      $('.prac-btn', card).addEventListener('click', () => togglePractice(song, card));
      list.appendChild(card);
    });
  }

  /* ------------------------------------------------------------ Listening */
  function togglePlay(song, card) {
    const btn = $('.rplay-btn', card);
    if (playTimers.length && btn.textContent.includes('중지')) { stopAllRep(); return; }
    ensureFullMode(false);               // key highlights live on the main keyboard
    stopAllRep();
    btn.textContent = '■ 중지';
    const beatMs = 60000 / song.bpm;
    let t = 250;
    song.notes.forEach(([id, beats], k) => {
      const duration = Math.max(180, beats * beatMs * .92);
      playTimers.push(setTimeout(() => {
        F.stopPreview();
        F.startPreview(id);
        $$('.rc-note', card).forEach((el, i) => el.classList.toggle('now', i === k));
      }, t));
      playTimers.push(setTimeout(() => F.endPreview(id), t + duration));
      t += beats * beatMs;
    });
    playTimers.push(setTimeout(() => stopPlayback(), t + 300));
  }

  /* ------------------------------------------------------------- Practice */
  function togglePractice(song, card) {
    if (prac && prac.songId === song.id) { stopAllRep(); return; }
    ensureFullMode(false);               // the guide glows on the main keyboard
    stopAllRep();
    prac = { songId: song.id, at: 0, off: null };
    $('.prac-btn', card).textContent = '■ 그만하기';
    const st = $('.rep-status', card);
    const mark = () => $$('.rc-note', card).forEach((el, i) => {
      el.classList.toggle('done', i < prac.at);
      el.classList.toggle('now', i === prac.at);
    });
    const cue = () => {
      mark();
      guideKey(song.notes[prac.at][0]);
      if (st) st.textContent = `진행 ${prac.at} / ${song.notes.length} — 반짝이는 건반을 연주하세요`;
    };
    cue();
    if (mainKb) mainKb.scrollIntoView({ behavior: OOT.api.prefersReduce() ? 'auto' : 'smooth', block: 'center' });
    prac.off = F.onNote((nid) => {
      if (!prac || prac.songId !== song.id) return;
      if (nid === song.notes[prac.at][0]) {
        prac.at++;
        if (prac.at >= song.notes.length) {
          learned.add(song.id);
          writeLS('oot-rep', [...learned]);
          if (OOT.progress) OOT.progress.event('repertoire', { count: learned.size });
          stopPractice('');
          render();
          const done = cardOf(song.id);
          const dst = done && $('.rep-status', done);
          if (dst) dst.textContent = `🎉 완주! "${song.nameKo}"를 익혔습니다.`;
        } else cue();
      } else if (st) {
        const want = F.NOTES[song.notes[prac.at][0]];
        st.textContent = `그 음은 ${F.NOTES[nid] ? F.NOTES[nid].label : nid} — 다음 음은 ${want.label}(${want.name})입니다.`;
      }
    });
  }

  renderListenWheel();
  if (listenPlay) listenPlay.addEventListener('click', playListenCurrent);
  if (listenStopBtn) listenStopBtn.addEventListener('click', () => stopListen());
  if (listenWheel) {
    listenWheel.addEventListener('wheel', (e) => {
      if (!e.deltaY) return;
      e.preventDefault();
      clearTimeout(listen.wheelResetTimer);
      listen.wheelResetTimer = setTimeout(() => {
        listen.wheelResetTimer = 0;
        listen.wheelDelta = 0;
        listen.wheelGestureMoved = false;
      }, WHEEL_GESTURE_IDLE_MS);

      /* A trackpad emits a stream of tiny inertial events. Accumulate them,
         then allow only one track change until that gesture has settled. */
      if (listen.wheelGestureMoved) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 40
        : e.deltaMode === 2 ? e.deltaY * 60 : e.deltaY;
      if (listen.wheelDelta && Math.sign(delta) !== Math.sign(listen.wheelDelta)) listen.wheelDelta = 0;
      listen.wheelDelta += delta;
      if (Math.abs(listen.wheelDelta) < WHEEL_GESTURE_DELTA) return;
      listen.wheelGestureMoved = true;
      listen.wheelDelta = 0;
      setListenSelection(listen.index + (delta > 0 ? 1 : -1), { scroll: true, user: true });
    }, { passive: false });
    listenWheel.addEventListener('scroll', () => {
      if (now() < listen.suppressScrollUntil) return;
      clearTimeout(listen.scrollTimer);
      listen.scrollTimer = setTimeout(() => {
        setListenSelection(listenIndexAtCenter(), { scroll: true, user: true });
      }, 90);
    });
    listenWheel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setListenSelection(listen.index + (e.key === 'ArrowDown' ? 1 : -1), { scroll: true, user: true });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playListenCurrent();
      }
    });
  }

  document.addEventListener('oot:listen-mode', (e) => {
    if (!e.detail || !e.detail.active) {
      if (listen.session || listen.playing) stopListen();
      return;
    }
    requestAnimationFrame(() => {
      setListenSelection(listen.index, { scroll: true });
      if (listenWheel) {
        try { listenWheel.focus({ preventScroll: true }); }
        catch (err) { listenWheel.focus(); }
      }
    });
  });

  render();
  document.addEventListener('oot:tab', stopAllRep);
  document.addEventListener('oot:stop', stopAllRep);

  // tiny probe for tests
  OOT._rep = () => ({
    songs: RSONGS.length, learned: [...learned], practicing: prac ? prac.songId : null,
    listenMode: document.body.classList.contains('listen-on'), listening: listen.session,
    listenPlaying: listen.playing, listenSong: selectedListenSong() ? selectedListenSong().id : null,
  });
})();
