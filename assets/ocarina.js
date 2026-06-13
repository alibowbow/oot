/* ============================================================================
 * Ocarina of Time — audio synthesis + interaction
 * ==========================================================================*/
(function () {
  'use strict';

  const { NOTES, NOTE_ORDER, SONGS, STAFF_Y } = window.OOT;

  /* ------------------------------------------------------------------ Audio */
  // An ocarina is a Helmholtz resonator: an almost pure tone with a little
  // breath and vibrato. We synthesise that with a sine (+ soft triangle body),
  // an LFO for vibrato, a warm low-pass, and a touch of reverb for ambience.
  class OcarinaSynth {
    constructor() { this.ctx = null; this.volume = 0.8; }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = (this.ctx = new AC());

        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(ctx.destination);

        // dry / wet split into a small generated reverb
        this.dry = ctx.createGain();
        this.dry.gain.value = 0.82;
        this.dry.connect(this.master);

        this.wet = ctx.createGain();
        this.wet.gain.value = 0.28;
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this._impulse(2.2, 2.4);
        this.reverb.connect(this.wet);
        this.wet.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    _impulse(seconds, decay) {
      const ctx = this.ctx, rate = ctx.sampleRate, len = rate * seconds;
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return buf;
    }

    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

    play(freq, dur = 0.62) {
      const ctx = this.ensure();
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const body = ctx.createOscillator();      // faint upper body
      body.type = 'triangle';
      body.frequency.value = freq;
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.10;

      const lfo = ctx.createOscillator();        // vibrato
      lfo.type = 'sine';
      lfo.frequency.value = 5.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.006;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfoGain.connect(body.frequency);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2100;
      filter.Q.value = 0.6;

      const env = ctx.createGain();
      const peak = 0.6, atk = 0.035, rel = 0.20;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(peak, t + atk);
      env.gain.setValueAtTime(peak, t + Math.max(atk, dur - rel));
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(filter);
      body.connect(bodyGain).connect(filter);
      filter.connect(env);
      env.connect(this.dry);
      env.connect(this.reverb);

      const stop = t + dur + 0.05;
      [osc, body, lfo].forEach((o) => { o.start(t); o.stop(stop); });
    }

    // bright little "secret discovered" sparkle
    sparkle() {
      const seq = [659.25, 783.99, 987.77, 1318.5];
      seq.forEach((f, i) => setTimeout(() => this.play(f, 0.28), i * 90));
    }
  }

  const synth = new OcarinaSynth();

  /* -------------------------------------------------------------------- DOM */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const buttons = {};        // note id -> button element
  const holes = {};          // note id -> ocarina hole element
  NOTE_ORDER.forEach((id) => {
    buttons[id] = $(`.note-btn[data-note="${id}"]`);
    holes[id] = $(`.hole[data-hole="${id}"]`);
  });

  const banner = $('#banner');
  const echo = $('#echo');     // shows the running stream of notes you play

  /* ------------------------------------------------------- Note triggering */
  let practice = null;         // active practice session, if any

  // Play a note + light up the button and the matching ocarina hole.
  // `record` feeds the free-play song detector; auto-play/practice pass false.
  function trigger(id, { dur = 0.62, record = true } = {}) {
    const note = NOTES[id];
    if (!note) return;
    synth.play(note.freq, dur);

    flash(buttons[id]);
    glow(holes[id], note.color);

    if (record) {
      pushEcho(id);
      detect(id);
    }
    if (practice) practiceInput(id);
  }

  function flash(btn) {
    if (!btn) return;
    btn.classList.remove('active');
    void btn.offsetWidth;           // restart the animation
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 220);
  }

  function glow(hole, color) {
    if (!hole) return;
    hole.style.setProperty('--glow', color);
    hole.classList.add('lit');
    setTimeout(() => hole.classList.remove('lit'), 260);
  }

  /* ------------------------------------------------- Free-play note stream */
  const echoBuf = [];
  function pushEcho(id) {
    echoBuf.push(id);
    if (echoBuf.length > 24) echoBuf.shift();
    if (echo) {
      echo.innerHTML = echoBuf
        .slice(-16)
        .map((n) => `<span style="color:${NOTES[n].color}">${NOTES[n].arrow}</span>`)
        .join('');
    }
  }

  /* ----------------------------------------------------- Song recognition */
  const recent = [];
  const maxLen = Math.max(...SONGS.map((s) => s.notes.length));
  let lastDetect = 0;

  function detect(id) {
    recent.push(id);
    if (recent.length > maxLen) recent.shift();

    for (const song of SONGS) {
      const n = song.notes.length;
      if (recent.length < n) continue;
      const tail = recent.slice(recent.length - n);
      if (tail.every((v, i) => v === song.notes[i])) {
        const now = Date.now();
        if (now - lastDetect < 900) return;     // debounce
        lastDetect = now;
        recent.length = 0;
        onSongPlayed(song);
        return;
      }
    }
  }

  function onSongPlayed(song) {
    synth.sparkle();
    showBanner(song);
    const card = $(`.song-card[data-song="${song.id}"]`);
    if (card) {
      card.classList.add('discovered');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => card.classList.remove('discovered'), 2400);
    }
  }

  let bannerTimer;
  function showBanner(song) {
    clearTimeout(bannerTimer);
    banner.innerHTML =
      `<span class="b-note">♪</span> You played <b>${song.name}</b> ` +
      `<span class="b-ko">${song.nameKo}</span> <span class="b-note">♪</span>` +
      `<small>${song.effect}</small>`;
    banner.classList.add('show');
    bannerTimer = setTimeout(() => banner.classList.remove('show'), 4200);
  }

  /* ----------------------------------------------------- Input: pad + keys */
  NOTE_ORDER.forEach((id) => {
    const btn = buttons[id];
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); trigger(id); });
  });

  const held = new Set();
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const id = keyToNote(e);
    if (!id) return;
    if (held.has(id)) return;
    held.add(id);
    e.preventDefault();
    trigger(id);
  });
  document.addEventListener('keyup', (e) => {
    const id = keyToNote(e);
    if (id) held.delete(id);
  });

  function keyToNote(e) {
    if (e.code === 'KeyA') return 'A';
    if (e.code === 'ArrowDown') return 'down';
    if (e.code === 'ArrowRight') return 'right';
    if (e.code === 'ArrowUp') return 'up';
    if (e.code === 'ArrowLeft') return 'left';
    return null;
  }

  /* -------------------------------------------------------- Auto-play song */
  let playToken = 0;
  function isPlaying() { return playToken !== 0; }

  function stopAll() {
    playToken = 0;
    practice = null;
    clearExpect();
    $$('.song-card').forEach((c) => c.classList.remove('playing'));
    $$('.play-btn').forEach((b) => (b.textContent = '▶ Play'));
  }

  async function playSong(song, card) {
    stopAll();
    const token = (playToken = Date.now());
    card.classList.add('playing');
    const pb = $('.play-btn', card);
    pb.textContent = '■ Stop';

    const gap = 360;
    for (let i = 0; i < song.notes.length; i++) {
      if (playToken !== token) return;             // stopped/interrupted
      const id = song.notes[i];
      const last = i === song.notes.length - 1;
      trigger(id, { dur: last ? 0.85 : 0.5, record: false });
      markStaff(card, i);
      await wait(gap);
    }
    await wait(260);
    if (playToken === token) {
      stopAll();
      markStaff(card, -1);
    }
  }

  /* -------------------------------------------------------- Practice mode */
  function startPractice(song, card) {
    stopAll();
    card.classList.add('playing');
    $('.learn-btn', card).textContent = '✕ Exit';
    practice = { song, card, index: 0 };
    expect(song.notes[0]);
    markStaff(card, 0);
  }

  function practiceInput(id) {
    if (!practice) return;
    const want = practice.song.notes[practice.index];
    if (id === want) {
      practice.index++;
      if (practice.index >= practice.song.notes.length) {
        const song = practice.song, card = practice.card;
        practice = null;
        clearExpect();
        $('.learn-btn', card).textContent = '✎ Practice';
        card.classList.remove('playing');
        markStaff(card, -1);
        onSongPlayed(song);                          // celebrate!
      } else {
        expect(practice.song.notes[practice.index]);
        markStaff(practice.card, practice.index);
      }
    } else {
      // wrong note — nudge the expected button
      const b = buttons[want];
      if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    }
  }

  function expect(id) {
    clearExpect();
    const b = buttons[id];
    if (b) b.classList.add('expect');
  }
  function clearExpect() { NOTE_ORDER.forEach((id) => buttons[id] && buttons[id].classList.remove('expect')); }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* --------------------------------------------------- Render the songbook */
  function staffSVG(ids) {
    const startX = 30, dx = 26, H = 86;
    const W = startX + ids.length * dx + 10;
    let lines = '';
    for (let i = 0; i < 5; i++) {
      const y = 20 + i * 10;
      lines += `<line x1="6" y1="${y}" x2="${W - 6}" y2="${y}"/>`;
    }
    let heads = '';
    ids.forEach((id, i) => {
      const x = startX + i * dx + dx / 2;
      const y = STAFF_Y[id];
      const c = NOTES[id].color;
      const ledger = id === 'A' ? `<line class="ledger" x1="${x - 9}" y1="60" x2="${x + 9}" y2="60"/>` : '';
      heads +=
        `<g class="snote" data-i="${i}">` +
        ledger +
        `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="4.1" fill="${c}" stroke="#14110a" stroke-width="0.8" transform="rotate(-20 ${x} ${y})"/>` +
        `<text x="${x}" y="82" text-anchor="middle" class="s-arrow" fill="${c}">${NOTES[id].arrow}</text>` +
        `</g>`;
    });
    return (
      `<svg class="staff" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sheet music">` +
      `<g class="s-lines">${lines}</g>` +
      `<text x="9" y="55" class="s-clef">𝄞</text>${heads}</svg>`
    );
  }

  function tabHTML(ids) {
    return ids
      .map((id) => {
        const n = NOTES[id];
        const cls = id === 'A' ? 'tab a' : 'tab c';
        return `<span class="${cls}" style="--c:${n.color}" title="${n.pitch}">${n.arrow}</span>`;
      })
      .join('');
  }

  function markStaff(card, index) {
    $$('.snote', card).forEach((g, i) => g.classList.toggle('on', i === index));
    $$('.tab', card).forEach((t, i) => t.classList.toggle('on', i === index));
  }

  function buildSongbook() {
    const wrap = $('#songbook');
    const groups = [
      { key: 'core', title: 'Ocarina Songs', sub: '기본 오카리나 곡' },
      { key: 'warp', title: 'Warp Songs', sub: '워프 곡' },
    ];

    groups.forEach((grp) => {
      const section = document.createElement('section');
      section.className = 'song-group';
      section.innerHTML = `<h3>${grp.title} <span>${grp.sub}</span></h3>`;
      const grid = document.createElement('div');
      grid.className = 'song-grid';

      SONGS.filter((s) => s.group === grp.key).forEach((song) => {
        const card = document.createElement('article');
        card.className = 'song-card';
        card.dataset.song = song.id;
        if (song.accent) card.style.setProperty('--accent', song.accent);

        card.innerHTML =
          `<header>` +
          `<div class="title"><b>${song.name}</b><span class="ko">${song.nameKo}</span></div>` +
          `</header>` +
          `<div class="tabs">${tabHTML(song.notes)}</div>` +
          staffSVG(song.notes) +
          `<p class="effect">${song.effect}</p>` +
          `<div class="actions">` +
          `<button class="play-btn">▶ Play</button>` +
          `<button class="learn-btn">✎ Practice</button>` +
          `</div>`;

        $('.play-btn', card).addEventListener('click', () => {
          const playingThis = card.classList.contains('playing') && isPlaying();
          if (playingThis) stopAll();
          else playSong(song, card);
        });
        $('.learn-btn', card).addEventListener('click', () => {
          const active = practice && practice.song.id === song.id;
          if (active) stopAll();
          else startPractice(song, card);
        });

        grid.appendChild(card);
      });

      section.appendChild(grid);
      wrap.appendChild(section);
    });
  }

  /* ------------------------------------------------------------- Controls */
  function wireControls() {
    const vol = $('#volume');
    if (vol) vol.addEventListener('input', () => synth.setVolume(parseFloat(vol.value)));

    const stop = $('#stop-all');
    if (stop) stop.addEventListener('click', stopAll);
  }

  /* ---------------------------------------------------------------- Start */
  buildSongbook();
  wireControls();
  // resume audio on first gesture (autoplay policies)
  window.addEventListener('pointerdown', () => synth.ensure(), { once: true });
  window.addEventListener('keydown', () => synth.ensure(), { once: true });
})();
