/* ============================================================================
 * Ocarina of Time — audio synthesis + interaction
 * ==========================================================================*/
(function () {
  'use strict';

  const { NOTES, NOTE_ORDER, SONGS, STAFF_Y } = window.OOT;

  // Pre-compute the bare button sequence + beat list for each song.
  SONGS.forEach((s) => {
    s.ids = s.notes.map((n) => n[0]);
    s.beats = s.notes.map((n) => n[1]);
  });

  /* ------------------------------------------------------------------ Audio */
  // An ocarina is a Helmholtz resonator: an almost pure tone with a little
  // breath and vibrato. We synthesise that with a sine (+ soft triangle body),
  // an LFO for vibrato, a warm low-pass, and a touch of reverb for ambience.
  class OcarinaSynth {
    constructor() { this.ctx = null; this.volume = 0.8; this.voices = {}; }

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
        this.wet.gain.value = 0.26;
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

    // Build the oscillator chain for one note (sine + soft triangle body +
    // eased-in vibrato + warm low-pass), routed dry + reverb. The envelope
    // starts silent; the caller shapes attack/sustain/release.
    _voice(freq) {
      const ctx = this.ctx, t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const body = ctx.createOscillator();      // faint upper body
      body.type = 'triangle';
      body.frequency.value = freq;
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.10;

      const lfo = ctx.createOscillator();        // vibrato eases in
      lfo.type = 'sine';
      lfo.frequency.value = 5.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.0001, t);
      lfoGain.gain.linearRampToValueAtTime(freq * 0.007, t + 0.25);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfoGain.connect(body.frequency);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2100;
      filter.Q.value = 0.6;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);

      osc.connect(filter);
      body.connect(bodyGain).connect(filter);
      filter.connect(env);
      env.connect(this.dry);
      env.connect(this.reverb);

      return { oscs: [osc, body, lfo], env };
    }

    // One-shot note of fixed length (auto-player / practice playback).
    play(freq, dur = 0.62) {
      const ctx = this.ensure();
      const t = ctx.currentTime;
      const v = this._voice(freq);
      const peak = 0.55, atk = 0.035, rel = Math.min(0.22, dur * 0.4);
      v.env.gain.exponentialRampToValueAtTime(peak, t + atk);
      v.env.gain.setValueAtTime(peak, t + Math.max(atk, dur - rel));
      v.env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const stop = t + dur + 0.05;
      v.oscs.forEach((o) => { o.start(t); o.stop(stop); });
    }

    // Press-and-hold: start a note that SUSTAINS until noteOff(id) is called,
    // so holding a button rings the note for as long as you hold it.
    noteOn(id, freq) {
      const ctx = this.ensure();
      const t = ctx.currentTime;
      if (this.voices[id]) this._releaseVoice(this.voices[id], 0.03);
      const v = this._voice(freq);
      v.env.gain.exponentialRampToValueAtTime(0.5, t + 0.04);    // attack, then hold
      v.oscs.forEach((o) => o.start(t));
      v.guard = setTimeout(() => this.noteOff(id), 20000);        // anti-stuck safety net
      this.voices[id] = v;
    }

    noteOff(id) {
      const v = this.voices[id];
      if (!v) return;
      this.voices[id] = null;
      this._releaseVoice(v, 0.24);
    }

    _releaseVoice(v, rel) {
      const ctx = this.ctx, t = ctx.currentTime;
      if (v.guard) { clearTimeout(v.guard); v.guard = null; }
      const g = v.env.gain;
      try {
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
        else { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); }
        g.exponentialRampToValueAtTime(0.0001, t + rel);
      } catch (e) { /* ignore */ }
      const stop = t + rel + 0.06;
      v.oscs.forEach((o) => { try { o.stop(stop); } catch (e) { /* already stopped */ } });
    }

    allOff() { Object.keys(this.voices).forEach((id) => this.noteOff(id)); }
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
  const held = new Set();      // note ids currently held down (key / pointer)

  // Press-and-hold: start a sustained note and keep its button + ocarina hole
  // lit until endNote() is called, so the note rings for as long as you hold.
  // `record` feeds the free-play song detector (auto-play passes false).
  function startNote(id, { record = true } = {}) {
    const note = NOTES[id];
    if (!note) return;
    synth.noteOn(id, note.freq);
    if (buttons[id]) buttons[id].classList.add('active');
    litOn(holes[id], note.color);
    if (record) { pushEcho(id); detect(id); }
    if (practice) practiceInput(id);
  }

  function endNote(id) {
    synth.noteOff(id);
    if (buttons[id]) buttons[id].classList.remove('active');
    litOff(holes[id]);
  }

  // One-shot timed note used by the auto-player (button/hole blink and fade).
  function pulseNote(id, dur) {
    const note = NOTES[id];
    if (!note) return;
    synth.play(note.freq, dur);
    flash(buttons[id]);
    glow(holes[id], note.color);
  }

  // Release everything (safety net for blur / Stop while notes are held).
  function releaseAllHeld() {
    held.clear();
    synth.allOff();
    NOTE_ORDER.forEach((id) => {
      if (buttons[id]) buttons[id].classList.remove('active');
      litOff(holes[id]);
    });
  }

  function litOn(hole, color) {
    if (!hole) return;
    hole.style.setProperty('--glow', color);
    hole.classList.add('lit');
  }
  function litOff(hole) { if (hole) hole.classList.remove('lit'); }

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
  // Free play only watches the *order* of buttons (rhythm-independent), just
  // like the game. No sound is added when a melody is recognised — only the
  // banner + a glow on the matching card.
  const recent = [];
  const maxLen = Math.max(...SONGS.map((s) => s.ids.length));
  let lastDetect = 0;

  function detect(id) {
    recent.push(id);
    if (recent.length > maxLen) recent.shift();

    for (const song of SONGS) {
      const ids = song.ids, n = ids.length;
      if (recent.length < n) continue;
      const tail = recent.slice(recent.length - n);
      if (tail.every((v, i) => v === ids[i])) {
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
    // Show the fixed top toast only — never scroll the page, so the player
    // stays on the ocarina while free-playing.
    showBanner(song);
    const card = $(`.song-card[data-song="${song.id}"]`);
    if (card) {
      card.classList.add('discovered');
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
  // Pointer: press to start the note, release to stop it. Pointer capture makes
  // sure the matching pointerup arrives even if the finger/cursor slides off.
  NOTE_ORDER.forEach((id) => {
    const btn = buttons[id];
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (held.has('p:' + e.pointerId)) return;
      held.add('p:' + e.pointerId);
      startNote(id);
    });
    const release = (e) => { if (held.delete('p:' + e.pointerId)) endNote(id); };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  });

  // Keyboard: keydown starts (autorepeat ignored), keyup releases.
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const id = keyToNote(e);
    if (!id || held.has('k:' + id)) return;
    held.add('k:' + id);
    e.preventDefault();
    startNote(id);
  });
  document.addEventListener('keyup', (e) => {
    const id = keyToNote(e);
    if (id && held.delete('k:' + id)) endNote(id);
  });

  // never leave a note droning if the window loses focus mid-hold
  window.addEventListener('blur', releaseAllHeld);

  function keyToNote(e) {
    if (e.code === 'KeyA') return 'A';
    if (e.code === 'ArrowDown') return 'down';
    if (e.code === 'ArrowRight') return 'right';
    if (e.code === 'ArrowUp') return 'up';
    if (e.code === 'ArrowLeft') return 'left';
    return null;
  }

  /* -------------------------------------------------------- Auto-play song */
  // Plays with each song's own tempo + per-note beats, so the rhythm is real.
  let playToken = 0;
  function isPlaying() { return playToken !== 0; }

  function stopAll() {
    playToken = 0;
    practice = null;
    clearExpect();
    $$('.song-card').forEach((c) => c.classList.remove('playing'));
    $$('.play-btn').forEach((b) => (b.textContent = '▶ Play'));
    $$('.learn-btn').forEach((b) => (b.textContent = '✎ Practice'));
    $$('.snote.on, .tab.on').forEach((e) => e.classList.remove('on'));
  }

  async function playSong(song, card) {
    stopAll();
    const token = (playToken = Date.now());
    card.classList.add('playing');
    $('.play-btn', card).textContent = '■ Stop';

    const beatMs = 60000 / song.bpm;
    for (let i = 0; i < song.notes.length; i++) {
      if (playToken !== token) return;             // stopped / interrupted
      const [id, beats] = song.notes[i];
      const ms = beats * beatMs;
      pulseNote(id, Math.max(0.18, (ms / 1000) * 0.94));
      markStaff(card, i);
      await wait(ms);
    }
    await wait(140);
    if (playToken === token) { stopAll(); markStaff(card, -1); }
  }

  /* -------------------------------------------------------- Practice mode */
  function startPractice(song, card) {
    stopAll();
    card.classList.add('playing');
    $('.learn-btn', card).textContent = '✕ Exit';
    practice = { song, card, index: 0 };
    expect(song.ids[0]);
    markStaff(card, 0);
  }

  function practiceInput(id) {
    if (!practice) return;
    const want = practice.song.ids[practice.index];
    if (id === want) {
      practice.index++;
      if (practice.index >= practice.song.ids.length) {
        const song = practice.song, card = practice.card;
        practice = null;
        clearExpect();
        $('.learn-btn', card).textContent = '✎ Practice';
        card.classList.remove('playing');
        markStaff(card, -1);
        onSongPlayed(song);                          // celebrate (visual only)
      } else {
        expect(practice.song.ids[practice.index]);
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
  // Build the staff for a song: real note values (filled/hollow heads, stems,
  // beamed eighths, dots) on five lines. A fixed width keeps every card's staff
  // aligned and stops notes/flags from overflowing or overlapping.
  function staffSVG(song) {
    const startX = 40, W = 344, H = 96, base = 20, scale = 14;
    const INK = '#403718';                         // neutral stem/beam colour
    const slot = (b) => base + b * scale;

    // 1) lay out note positions (cx = centre, cy = pitch height)
    let x = startX;
    const ns = song.notes.map(([id, beats], i) => {
      const cx = x + slot(beats) / 2;
      x += slot(beats);
      return { i, id, beats, cx, cy: STAFF_Y[id], color: NOTES[id].color };
    });

    // 2) beam consecutive eighth notes; remember each beam's stem-top Y
    const beamed = new Array(ns.length).fill(false);
    const beams = [];
    for (let a = 0; a < ns.length; ) {
      if (ns[a].beats <= 0.5) {
        let b = a;
        while (b + 1 < ns.length && ns[b + 1].beats <= 0.5) b++;
        if (b > a) {
          const topY = Math.min(...ns.slice(a, b + 1).map((n) => n.cy)) - 26;
          for (let k = a; k <= b; k++) { beamed[k] = true; ns[k].beamTop = topY; }
          beams.push([a, b, topY]);
        }
        a = b + 1;
      } else a++;
    }

    // 3) note glyphs: stem (+ flag if a lone eighth), notehead, dot, button arrow
    let items = '';
    ns.forEach((n, idx) => {
      const open = n.beats >= 2;                   // half / dotted-half = hollow
      const dotted = n.beats === 0.75 || n.beats === 1.5 || n.beats === 3;
      const sx = n.cx + 5;
      const top = beamed[idx] ? n.beamTop : n.cy - 26;
      let g = `<g class="snote" data-i="${n.i}">`;
      if (n.id === 'A') g += `<line class="ledger" x1="${n.cx - 9}" y1="60" x2="${n.cx + 9}" y2="60"/>`;
      g += `<line x1="${sx}" y1="${n.cy - 0.5}" x2="${sx}" y2="${top}" stroke="${INK}" stroke-width="1.7"/>`;
      if (!beamed[idx] && n.beats <= 0.75) {
        g += `<path d="M${sx},${top} q9,3 6,14 q2,-8 -6,-11 z" fill="${INK}"/>`;
      }
      g += `<ellipse class="head" cx="${n.cx}" cy="${n.cy}" rx="5.6" ry="4.2" ` +
           `transform="rotate(-20 ${n.cx} ${n.cy})" fill="${open ? 'none' : n.color}" ` +
           `stroke="${n.color}" stroke-width="${open ? 1.8 : 0.9}"/>`;
      if (dotted) g += `<circle cx="${n.cx + 10}" cy="${n.cy - 1}" r="1.7" fill="${n.color}"/>`;
      g += `<text x="${n.cx}" y="88" text-anchor="middle" class="s-arrow" fill="${n.color}">${NOTES[n.id].arrow}</text></g>`;
      items += g;
    });

    // 4) beam crossbars (drawn on top, shared by the run)
    let beamSVG = '';
    beams.forEach(([a, b, topY]) => {
      const x0 = ns[a].cx + 5, x1 = ns[b].cx + 5;
      beamSVG += `<rect x="${x0}" y="${topY - 1.5}" width="${x1 - x0}" height="3.4" rx="0.6" fill="${INK}"/>`;
    });

    // 5) five staff lines + treble clef
    let lines = '';
    for (let i = 0; i < 5; i++) {
      const ly = 20 + i * 10;
      lines += `<line x1="6" y1="${ly}" x2="${W - 6}" y2="${ly}"/>`;
    }
    return (
      `<svg class="staff" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" ` +
      `role="img" aria-label="Sheet music with rhythm">` +
      `<g class="s-lines">${lines}</g><text x="9" y="55" class="s-clef">𝄞</text>${items}${beamSVG}</svg>`
    );
  }

  function tabHTML(song) {
    return song.notes
      .map(([id, beats]) => {
        const n = NOTES[id];
        const cls = id === 'A' ? 'tab a' : 'tab c';
        const w = Math.round(26 + beats * 7);      // wider chip = longer note
        return `<span class="${cls}" style="--c:${n.color};width:${w}px" title="${n.pitch} · ${beats} beat">${n.arrow}</span>`;
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
          `<header><div class="title"><b>${song.name}</b><span class="ko">${song.nameKo}</span></div>` +
          `<span class="bpm">♩=${song.bpm}</span></header>` +
          `<div class="tabs">${tabHTML(song)}</div>` +
          staffSVG(song) +
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

    // suppress the mobile long-press copy/context menu over the play area
    const inst = $('.instrument');
    if (inst) inst.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------------------------------------------------------------- Start */
  buildSongbook();
  wireControls();
  // resume audio on first gesture (autoplay policies)
  window.addEventListener('pointerdown', () => synth.ensure(), { once: true });
  window.addEventListener('keydown', () => synth.ensure(), { once: true });
})();
