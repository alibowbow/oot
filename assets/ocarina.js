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
  // An ocarina is a Helmholtz resonator — an almost-pure tone with breath and
  // vibrato. We voice it as a sine fundamental + faint upper harmonics, add
  // band-passed breath noise with an onset chiff, give it a living vibrato +
  // tremolo, a register-scaled warm filter, subtle pitch-panned stereo, a
  // stone-hall reverb, and a master-bus limiter so stacked held notes never clip.
  class OcarinaSynth {
    constructor() { this.ctx = null; this.volume = 0.85; this.muted = false; this.voices = {}; }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = (this.ctx = new AC());

        // voices sum into bus -> limiter -> master(volume) -> destination
        this.bus = ctx.createGain(); this.bus.gain.value = 1.0;
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -4;
        this.limiter.knee.value = 4;
        this.limiter.ratio.value = 18;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.12;
        this.master = ctx.createGain();
        this.master.gain.value = this._volGain(this.muted ? 0 : this.volume);
        this.bus.connect(this.limiter);
        this.limiter.connect(this.master);
        this.master.connect(ctx.destination);

        // dry path
        this.dry = ctx.createGain(); this.dry.gain.value = 0.85;
        this.dry.connect(this.bus);

        // reverb send: HP -> LP keep breath hiss out of the tail -> convolver
        this.revHP = ctx.createBiquadFilter(); this.revHP.type = 'highpass'; this.revHP.frequency.value = 200;
        this.revLP = ctx.createBiquadFilter(); this.revLP.type = 'lowpass'; this.revLP.frequency.value = 3200;
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this._impulse(2.3);
        this.wet = ctx.createGain(); this.wet.gain.value = 0.24;
        this.revHP.connect(this.revLP).connect(this.reverb).connect(this.wet);
        this.wet.connect(this.bus);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    // perceptual volume curve; 0.92 ceiling leaves the limiter headroom
    _volGain(v) { return Math.pow(Math.max(0, v), 1.8) * 0.92; }

    // Small stone-hall impulse: a silent pre-delay, a decaying noise tail whose
    // high end darkens over time (one-pole LP with a shrinking coefficient), plus
    // a few early reflections sign-flipped per channel for width.
    _impulse(seconds) {
      const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds);
      const pre = Math.floor(rate * 0.014);
      const buf = ctx.createBuffer(2, len, rate);
      const refl = [[0.011, 0.5], [0.019, 0.38], [0.029, 0.28], [0.041, 0.2]];
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = pre; i < len; i++) {
          const p = (i - pre) / (len - pre);
          const coef = 0.35 - 0.3 * p;                 // tail progressively darkens
          lp += coef * ((Math.random() * 2 - 1) - lp);
          d[i] = lp * Math.pow(1 - p, 2.6);
        }
        const sign = ch === 0 ? 1 : -1;
        refl.forEach(([ms, g]) => {
          const idx = pre + Math.floor(ms * rate);
          if (idx < len) d[idx] += sign * g;
        });
      }
      return buf;
    }

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.setTargetAtTime(this._volGain(this.muted ? 0 : v), this.ctx.currentTime, 0.02);
    }
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(this._volGain(m ? 0 : this.volume), this.ctx.currentTime, 0.02);
    }

    // White-noise buffer for the breath component (cached, looped per voice).
    _noiseBuffer() {
      if (this._noise) return this._noise;
      const ctx = this.ctx, len = Math.floor(ctx.sampleRate * 1.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
      return buf;
    }

    // subtle pitch-mapped pan (D4 ≈ left … D5 ≈ right), centred on the range
    _pan(freq) { return Math.max(-0.24, Math.min(0.24, Math.log2(freq / 415.3) * 0.44)); }

    // Build one living ocarina voice. The envelope starts silent; the caller
    // shapes attack / sustain / release. Returns sources to start/stop + env.
    _voice(freq, pan) {
      const ctx = this.ctx, t = ctx.currentTime;
      const rnd = (a, b) => a + Math.random() * (b - a);
      const tone = ctx.createGain();

      // harmonic sines: fundamental dominant + faint 2nd/3rd/4th
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
      const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 3;
      const o4 = ctx.createOscillator(); o4.type = 'sine'; o4.frequency.value = freq * 4;
      const g2 = ctx.createGain(); g2.gain.value = 0.10;
      const g3 = ctx.createGain(); g3.gain.value = 0.03;
      const g4 = ctx.createGain(); g4.gain.value = 0.010;
      o1.connect(tone);
      o2.connect(g2).connect(tone);
      o3.connect(g3).connect(tone);
      o4.connect(g4).connect(tone);

      // onset pitch scoop (-18 cents → 0 over 50 ms), coherent on all partials
      const parts = [o1, o2, o3, o4];
      parts.forEach((o) => { o.detune.setValueAtTime(-18, t); o.detune.linearRampToValueAtTime(0, t + 0.05); });

      // vibrato via detune — blooms as the note is held; slightly random rate
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rnd(5.0, 5.6);
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.setValueAtTime(0.0001, t);
      lfoAmt.gain.linearRampToValueAtTime(16, t + 0.4);          // cents
      lfoAmt.gain.linearRampToValueAtTime(24, t + 1.5);
      lfo.connect(lfoAmt);
      parts.forEach((o) => lfoAmt.connect(o.detune));

      // breath: HP → band-pass noise, a chiff at the onset then a low hiss
      const noise = ctx.createBufferSource();
      noise.buffer = this._noiseBuffer(); noise.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = Math.min(freq * 2.2, 5000); bp.Q.value = 0.9;
      const breath = ctx.createGain();
      breath.gain.setValueAtTime(0.0001, t);
      breath.gain.linearRampToValueAtTime(0.085, t + 0.012);
      breath.gain.exponentialRampToValueAtTime(0.022, t + 0.10);
      noise.connect(hp).connect(bp).connect(breath).connect(tone);

      // body peak + register-scaled warm low-pass (low notes stay mellow)
      const peakF = ctx.createBiquadFilter(); peakF.type = 'peaking';
      peakF.frequency.value = 1600; peakF.Q.value = 1.1; peakF.gain.value = 3.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = Math.min(6500, Math.max(1400, freq * 6.5)); lp.Q.value = 0.5;

      const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t);

      // amplitude tremolo: loudness wavers with the vibrato + a slow breath swell
      const trem = ctx.createGain(); trem.gain.value = 1.0;
      const tremDepth = ctx.createGain(); tremDepth.gain.value = 0.06;
      lfo.connect(tremDepth).connect(trem.gain);
      const swell = ctx.createOscillator(); swell.type = 'sine'; swell.frequency.value = rnd(0.28, 0.45);
      const swellDepth = ctx.createGain(); swellDepth.gain.value = 0.05;
      swell.connect(swellDepth).connect(trem.gain);

      tone.connect(peakF).connect(lp).connect(env).connect(trem);

      // output (+ subtle pitch-panned stereo where supported), dry + reverb send
      let out = trem;
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner(); panner.pan.value = pan || 0;
        trem.connect(panner); out = panner;
      }
      out.connect(this.dry);
      out.connect(this.revHP);

      // start the looping noise at a random offset so no two attacks are identical
      noise._offset = Math.random() * 1.4;
      return { sources: [o1, o2, o3, o4, lfo, swell, noise], env, peakVar: rnd(0.96, 1.04) };
    }

    _start(v, t) {
      v.sources.forEach((o) => { try { o.start(t, o._offset || 0); } catch (e) { try { o.start(t); } catch (_) {} } });
    }

    // One-shot note of fixed length (auto-player / practice playback).
    play(freq, dur = 0.62) {
      const ctx = this.ensure();
      const t = ctx.currentTime;
      const v = this._voice(freq, this._pan(freq));
      const peak = 0.42 * v.peakVar, atk = 0.04, rel = Math.min(0.22, dur * 0.4);
      v.env.gain.setValueAtTime(0.0001, t);
      v.env.gain.exponentialRampToValueAtTime(peak, t + atk);
      v.env.gain.setValueAtTime(peak, t + Math.max(atk, dur - rel));
      v.env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const stop = t + dur + 0.05;
      this._start(v, t);
      v.sources.forEach((o) => o.stop(stop));
    }

    // Press-and-hold: start a note that SUSTAINS until noteOff(id) is called,
    // so holding a button rings the note for as long as you hold it.
    noteOn(id, freq) {
      const ctx = this.ensure();
      const t = ctx.currentTime;
      if (this.voices[id]) this._releaseVoice(this.voices[id], 0.03);
      const v = this._voice(freq, this._pan(freq));
      v.env.gain.exponentialRampToValueAtTime(0.40 * v.peakVar, t + 0.05);  // attack, then hold
      this._start(v, t);
      v.guard = setTimeout(() => this.noteOff(id), 20000);                   // anti-stuck safety net
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
      v.sources.forEach((o) => { try { o.stop(stop); } catch (e) { /* already stopped */ } });
    }

    allOff() { Object.keys(this.voices).forEach((id) => this.noteOff(id)); }
  }

  const synth = new OcarinaSynth();

  /* -------------------------------------------------------------------- DOM */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const buttons = {};        // note id -> main pad button
  const minis = {};          // note id -> fixed mini-pad button (games/studio)
  const holes = {};          // note id -> ocarina hole element
  NOTE_ORDER.forEach((id) => {
    buttons[id] = $(`.note-btn[data-note="${id}"]`);
    minis[id] = $(`#mini-pad .note-btn[data-note="${id}"]`);
    holes[id] = $(`.hole[data-hole="${id}"]`);
  });
  // apply a state change to the main button AND its mini-pad mirror
  const eachBtn = (id, fn) => { if (buttons[id]) fn(buttons[id]); if (minis[id]) fn(minis[id]); };

  const banner = $('#banner');
  const echo = $('#echo');     // shows the running stream of notes you play
  const practiceStatus = $('#practice-status');   // sr-only live region

  /* ------------------------------------------------------- Note triggering */
  let practice = null;         // active practice session, if any
  const held = new Set();      // note ids currently held down (key / pointer)

  // Event buses so add-on modules (studio / games / progress) can listen to the
  // instrument without reaching into its internals. pulseNote (auto-play) does
  // NOT emit — only real user input counts.
  const noteSubs = new Set();     // fn(id) on user note start
  const noteEndSubs = new Set();  // fn(id) on user note release
  const songSubs = new Set();     // fn({type:'song'|'scarecrow', song?, practiced?})
  let scarecrowIds = null;        // user-registered 8-note Scarecrow's Song

  // Press-and-hold: start a sustained note and keep its button + ocarina hole
  // lit until endNote() is called, so the note rings for as long as you hold.
  // `record` feeds the free-play song detector (auto-play passes false).
  function startNote(id, { record = true } = {}) {
    const note = NOTES[id];
    if (!note) return;
    synth.noteOn(id, note.freq);
    eachBtn(id, (b) => b.classList.add('active'));
    litOn(holes[id], note.color);
    spawnMotes(note.color, 2);
    if (record) { pushEcho(id); detect(id); }
    if (practice) practiceInput(id);
    noteSubs.forEach((f) => { try { f(id); } catch (e) { /* listener error */ } });
  }

  function endNote(id) {
    synth.noteOff(id);
    eachBtn(id, (b) => b.classList.remove('active'));
    litOff(holes[id]);
    noteEndSubs.forEach((f) => { try { f(id); } catch (e) { /* listener error */ } });
  }

  // One-shot timed note used by the auto-player (button/hole blink and fade).
  function pulseNote(id, dur) {
    const note = NOTES[id];
    if (!note) return;
    synth.play(note.freq, dur);
    eachBtn(id, flash);                 // main pad + mini-pad both blink
    glow(holes[id], note.color);
    spawnMotes(note.color, 1);
  }

  // Release everything (safety net for blur / Stop while notes are held).
  function releaseAllHeld() {
    held.clear();
    synth.allOff();
    NOTE_ORDER.forEach((id) => {
      eachBtn(id, (b) => b.classList.remove('active'));
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
  let echoTimer;
  function pushEcho(id) {
    if (!echo) return;
    const s = document.createElement('span');
    s.textContent = NOTES[id].arrow;
    s.style.color = NOTES[id].color;
    echo.appendChild(s);                            // append one glyph — only it animates
    while (echo.children.length > 16) echo.removeChild(echo.firstChild);
    const kids = echo.children, n = kids.length;    // comet trail: older glyphs dimmer
    for (let i = 0; i < n; i++) kids[i].style.opacity = (0.32 + 0.68 * (i + 1) / n).toFixed(2);
    echo.classList.remove('fade');
    clearTimeout(echoTimer);
    echoTimer = setTimeout(() => echo.classList.add('fade'), 4000);
  }

  /* ----------------------------------------------------- Song recognition */
  // Free play only watches the *order* of buttons (rhythm-independent), just
  // like the game. No sound is added when a melody is recognised — only the
  // banner + a glow on the matching card.
  const recent = [];
  const maxLen = Math.max(...SONGS.map((s) => s.ids.length));
  let lastDetect = 0, lastNoteTime = 0;

  function detect(id) {
    const now = Date.now();
    if (now - lastNoteTime > 2500) recent.length = 0;   // drop stale noodling
    lastNoteTime = now;
    recent.push(id);
    if (recent.length > maxLen) recent.shift();

    for (const song of SONGS) {
      const ids = song.ids, n = ids.length;
      if (recent.length < n) continue;
      const tail = recent.slice(recent.length - n);
      if (tail.every((v, i) => v === ids[i])) {
        if (now - lastDetect < 900) return;     // debounce
        lastDetect = now;
        recent.length = 0;
        onSongPlayed(song);
        return;
      }
    }

    // the player's own registered 8-note Scarecrow's Song
    if (scarecrowIds && recent.length >= 8) {
      const tail8 = recent.slice(-8);
      if (tail8.every((v, i) => v === scarecrowIds[i])) {
        if (now - lastDetect < 900) return;
        lastDetect = now;
        recent.length = 0;
        onScarecrowPlayed();
      }
    }
  }

  function onScarecrowPlayed() {
    banner.innerHTML =
      `<span class="b-note">♪</span> You played the <b>Scarecrow's Song</b> ` +
      `<span class="b-ko" lang="ko">허수아비의 노래</span> <span class="b-note">♪</span>` +
      `<small>Your own melody echoes across Hyrule…</small>`;
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('show'), 4200);
    if (!prefersReduce()) sparkles(10, '#e8c76a');
    songSubs.forEach((f) => { try { f({ type: 'scarecrow' }); } catch (e) { /* listener */ } });
  }

  function onSongPlayed(song, opts = {}) {
    // Purely visual celebration — NEVER makes sound (free-play requirement).
    showBanner(song, opts);
    worldFx(song);
    markLearned(song);
    songSubs.forEach((f) => { try { f({ type: 'song', song, practiced: !!opts.practiced }); } catch (e) { /* listener */ } });
    const card = $(`.song-card[data-song="${song.id}"]`);
    if (card) {
      card.classList.remove('discovered'); void card.offsetWidth;   // restart glow
      card.classList.add('discovered');
      setTimeout(() => card.classList.remove('discovered'), 2400);
    }
  }

  let bannerTimer;
  function showBanner(song, opts = {}) {
    clearTimeout(bannerTimer);
    const lead = opts.practiced ? 'Song learned! You played' : 'You played';
    banner.innerHTML =
      `<span class="b-note">♪</span> ${lead} <b>${song.name}</b> ` +
      `<span class="b-ko" lang="ko">${song.nameKo}</span> <span class="b-note">♪</span>` +
      `<small>${song.effect}</small>`;
    banner.classList.add('show');
    bannerTimer = setTimeout(() => banner.classList.remove('show'), 4200);
  }

  /* ------------------------------------------- Visual world reactions (fx) */
  // Every effect here is PURELY VISUAL (no Web Audio) so free-play recognition
  // never makes sound. All of it is gated behind prefers-reduced-motion.
  const prefersReduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fxLayer = $('.fx');

  // breath motes rise off the instrument as notes sound (pooled, capped)
  const instrumentEl = $('.instrument');
  let moteLayer = null, moteCount = 0;
  if (instrumentEl) { moteLayer = document.createElement('div'); moteLayer.className = 'motes'; instrumentEl.appendChild(moteLayer); }
  function spawnMotes(color, n) {
    if (!moteLayer || prefersReduce() || moteCount > 22) return;
    for (let i = 0; i < n; i++) {
      const m = document.createElement('span');
      m.className = 'mote';
      m.style.setProperty('--c', color);
      m.style.left = (40 + Math.random() * 22).toFixed(0) + '%';
      m.style.setProperty('--dx', (Math.random() * 26 - 13).toFixed(0) + 'px');
      moteLayer.appendChild(m); moteCount++;
      setTimeout(() => { m.remove(); moteCount--; }, 850);
    }
  }

  function worldFx(song) {
    const accent = song.accent || getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#f6c61f';
    if (prefersReduce()) { flashVignette(accent); return; }

    if (song.id === 'suns') document.body.classList.toggle('daytime');   // day <-> night, like the game
    else if (song.id === 'storms') {
      document.body.classList.add('raining');
      lightning(); setTimeout(lightning, 1500);
      clearTimeout(worldFx._rain);
      worldFx._rain = setTimeout(() => document.body.classList.remove('raining'), 6000);
    }

    if (song.group === 'warp') { pillar(accent); sparkles(14, accent); }
    else { triforceFlare(); sparkles(8, '#f6e08a'); }
  }

  function flashVignette(color) {
    if (!fxLayer) return;
    fxLayer.style.setProperty('--fx', color);
    fxLayer.classList.remove('vignette'); void fxLayer.offsetWidth;
    fxLayer.classList.add('vignette');
    setTimeout(() => fxLayer.classList.remove('vignette'), 520);
  }
  function pillar(color) {
    if (!fxLayer) return;
    const el = document.createElement('div');
    el.className = 'pillar'; el.style.setProperty('--fx', color);
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  function lightning() {
    if (!fxLayer) return;
    const el = document.createElement('div');
    el.className = 'lightning';
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }
  function triforceFlare() {
    const tri = $('.triforce');
    if (!tri) return;
    tri.classList.remove('flare'); void tri.offsetWidth; tri.classList.add('flare');
    setTimeout(() => tri.classList.remove('flare'), 850);
  }
  function sparkles(n, color) {
    if (!fxLayer) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 170;
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(0) + 'px');
      s.style.setProperty('--fx', color);
      fxLayer.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }

  /* ------------------------------------------- Collection (localStorage) */
  const LEARNED_KEY = 'oot-learned';
  let learned = new Set();
  try { learned = new Set(JSON.parse(localStorage.getItem(LEARNED_KEY) || '[]')); } catch (e) { /* file:// / private mode */ }

  function markLearned(song) {
    if (learned.has(song.id)) return;
    learned.add(song.id);
    try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...learned])); } catch (e) { /* ignore */ }
    applyLearned(song.id);
    updateTally();
  }
  function applyLearned(id) { const c = $(`.song-card[data-song="${id}"]`); if (c) c.classList.add('learned'); }
  function updateTally() { const el = $('#tally'); if (el) el.textContent = `${learned.size} / ${SONGS.length}`; }

  /* ----------------------------------------------------- Input: pad + keys */
  // Press-and-hold on any element (button OR the ocarina's own hole) for a note.
  // Pointer capture makes the matching pointerup arrive even if the finger
  // slides off; <button>s also sustain while Space/Enter is held (keyboard).
  function bindHold(el, id, prefix) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const k = prefix + e.pointerId;
      if (held.has(k)) return;
      held.add(k);
      startNote(id);
    });
    const release = (e) => { if (held.delete(prefix + e.pointerId)) endNote(id); };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    if (el.tagName === 'BUTTON') {
      el.addEventListener('keydown', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();                       // no native click, no page scroll
        if (e.repeat || held.has('b:' + id)) return;
        held.add('b:' + id); startNote(id);
      });
      el.addEventListener('keyup', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && held.delete('b:' + id)) endNote(id);
      });
    }
  }

  NOTE_ORDER.forEach((id) => {
    bindHold(buttons[id], id, 'p:');
    bindHold(minis[id], id, 'm:');
    bindHold($(`.hit[data-hole="${id}"]`), id, 'h:');
  });

  // Global arrow/A keys play — but only while "at the instrument" (body or the
  // instrument panel is focused), so the volume slider keeps its arrows and the
  // songbook still scrolls with arrows. preventDefault (even on autorepeat)
  // stops the page scrolling for the whole time a note is sustained.
  document.addEventListener('keydown', (e) => {
    const id = keyToNote(e);
    if (!id) return;
    const el = e.target;
    if (el && el.closest && el.closest('input, select, textarea, [contenteditable]')) return;
    // playable while "at the instrument" or inside a panel that opts in
    // (studio / games), so recordings and games can be played by keyboard too
    const atInstrument = el === document.body || (el.closest && el.closest('.instrument, [data-keys-ok]'));
    if (!atInstrument) return;
    e.preventDefault();
    if (e.repeat || held.has('k:' + id)) return;
    held.add('k:' + id);
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
  let rate = 1;                          // playback-speed multiplier
  function isPlaying() { return playToken !== 0; }

  function setRate(r) {
    rate = r;
    $$('.tempo button').forEach((b) => {
      const on = parseFloat(b.dataset.rate) === r;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function stopAll() {
    playToken = 0;
    practice = null;
    clearExpect();
    $$('.song-card').forEach((c) => c.classList.remove('playing'));
    $$('.play-btn').forEach((b) => (b.textContent = '▶ Play'));
    $$('.learn-btn').forEach((b) => (b.textContent = '✎ Practice'));
    $$('.snote.on, .tab.on').forEach((e) => e.classList.remove('on'));
  }

  // Play any song-like object ({notes, bpm}) — `card` is optional so the
  // compose studio can preview a take without a songbook card.
  async function playSong(song, card) {
    stopAll();
    const token = (playToken = Date.now());
    if (card) {
      card.classList.add('playing');
      const pb = $('.play-btn', card);
      if (pb) pb.textContent = '■ Stop';
    }

    const beatMs = 60000 / song.bpm / rate;
    for (let i = 0; i < song.notes.length; i++) {
      if (playToken !== token) return;             // stopped / interrupted
      const [id, beats] = song.notes[i];
      const ms = beats * beatMs;
      pulseNote(id, Math.max(0.18, (ms / 1000) * 0.94));
      if (card) markStaff(card, i);
      await wait(ms);
    }
    await wait(140);
    if (playToken === token) { stopAll(); if (card) markStaff(card, -1); }
  }

  /* -------------------------------------------------------- Practice mode */
  function setPracticeStatus(msg) { if (practiceStatus) practiceStatus.textContent = msg; }

  function startPractice(song, card) {
    stopAll();
    card.classList.add('playing');
    practice = { song, card, index: 0 };
    updatePracticeUI();
    expect(song.ids[0], `Practising ${song.name}. `);   // fold intro into the first cue
    markStaff(card, 0);
  }

  function updatePracticeUI() {
    if (!practice) return;
    const lb = $('.learn-btn', practice.card);
    if (lb) lb.textContent = `✕ Exit · ${practice.index}/${practice.song.ids.length}`;
  }

  function practiceInput(id) {
    if (!practice) return;
    const want = practice.song.ids[practice.index];
    if (id === want) {
      practice.index++;
      updatePracticeUI();
      if (practice.index >= practice.song.ids.length) {
        const song = practice.song, card = practice.card;
        practice = null;
        clearExpect();
        $('.learn-btn', card).textContent = '✎ Practice';
        card.classList.remove('playing');
        markStaff(card, -1);
        onSongPlayed(song, { practiced: true });     // celebrate (visual only)
      } else {
        expect(practice.song.ids[practice.index]);
        markStaff(practice.card, practice.index);
      }
    } else {
      // wrong note — nudge + a static ring (visible under reduced-motion too)
      eachBtn(want, (b) => {
        b.classList.remove('shake', 'wrong'); void b.offsetWidth;
        b.classList.add('shake', 'wrong');
        setTimeout(() => b.classList.remove('wrong'), 340);
      });
      const b = buttons[want];
      if (b) setPracticeStatus(`Not quite — play ${b.getAttribute('aria-label')}`);
    }
  }

  function expect(id, prefix = '') {
    clearExpect();
    eachBtn(id, (b) => b.classList.add('expect'));
    const b = buttons[id];
    if (b) setPracticeStatus(`${prefix}Next: ${b.getAttribute('aria-label')}`);
  }
  function clearExpect() { NOTE_ORDER.forEach((id) => eachBtn(id, (b) => b.classList.remove('expect'))); }

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
      // D4 (the A button) sits in the space just below the bottom line (E4) —
      // no ledger line (that would be middle C, one step lower).
      let g = `<g class="snote" data-i="${n.i}">`;
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
      section.innerHTML = `<h2>${grp.title} <span lang="ko">${grp.sub}</span></h2>`;
      const grid = document.createElement('div');
      grid.className = 'song-grid';

      SONGS.filter((s) => s.group === grp.key).forEach((song) => {
        const card = document.createElement('article');
        card.className = 'song-card';
        card.dataset.song = song.id;
        if (song.accent) card.style.setProperty('--accent', song.accent);

        card.innerHTML =
          `<header><div class="title"><h3 class="c-name">${song.name}</h3><span class="ko" lang="ko">${song.nameKo}</span></div>` +
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
    const muteBtn = $('#mute-btn');

    // restore persisted volume + mute (localStorage may throw on file://)
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('oot-audio') || 'null'); } catch (e) { /* ignore */ }
    if (stored && typeof stored.v === 'number') { synth.volume = stored.v; if (vol) vol.value = stored.v; }
    if (stored && stored.m && muteBtn) { synth.muted = true; muteBtn.classList.add('muted'); muteBtn.setAttribute('aria-pressed', 'true'); }
    const persist = () => { try { localStorage.setItem('oot-audio', JSON.stringify({ v: synth.volume, m: synth.muted })); } catch (e) { /* ignore */ } };

    function setMute(m) {
      synth.setMuted(m);
      if (muteBtn) {
        muteBtn.classList.toggle('muted', m);
        muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');   // stable name "Mute" conveys the thing; pressed conveys state
      }
      persist();
    }
    if (vol) vol.addEventListener('input', () => { synth.setVolume(parseFloat(vol.value)); if (synth.muted) setMute(false); persist(); });
    if (muteBtn) muteBtn.addEventListener('click', () => { synth.ensure(); setMute(!synth.muted); });

    // tempo (playback speed) — setRate(1) also seeds aria-pressed on all three
    $$('.tempo button').forEach((b) => b.addEventListener('click', () => setRate(parseFloat(b.dataset.rate))));
    setRate(1);

    // Stop = panic: release held sustains + any in-flight auto-play, reset UI,
    // and tell add-on modules (games / studio) to stand down too
    const stop = $('#stop-all');
    if (stop) stop.addEventListener('click', () => {
      releaseAllHeld(); synth.allOff(); stopAll();
      document.dispatchEvent(new CustomEvent('oot:stop'));
    });

    // suppress the mobile long-press copy/context menu over the play area
    const inst = $('.instrument');
    if (inst) inst.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ----------------------------------------------------------------- Tabs */
  function initTabs() {
    const btns = $$('.tabbtn');
    if (!btns.length) return;
    const show = (key) => {
      btns.forEach((b) => {
        const on = b.dataset.tab === key;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      $$('.tabpanel').forEach((p) => { p.hidden = p.id !== 'panel-' + key; });
      // games / studio live far below the main pad — dock a mini-pad at the
      // bottom of the screen so the instrument stays under your thumbs
      document.body.classList.toggle('minipad-on', key === 'games' || key === 'studio');
      stopAll();                                   // leaving a tab stops playback
      document.dispatchEvent(new CustomEvent('oot:tab', { detail: key }));
    };
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
    const skip = $('.skip-link');
    if (skip) skip.addEventListener('click', () => {
      show('songbook');
      setTimeout(() => { const t = $('#songbook'); if (t) t.focus(); }, 0);
    });
  }

  /* --------------------------------------------- API for add-on modules */
  // studio.js / games.js / progress.js build on this surface instead of
  // reaching into the instrument's internals.
  OOT.api = {
    synth, startNote, endNote, pulseNote, playSong, stopAll, isPlaying,
    staffSVG, tabHTML, markStaff, sparkles, prefersReduce,
    onNote: (f) => { noteSubs.add(f); return () => noteSubs.delete(f); },
    onNoteEnd: (f) => { noteEndSubs.add(f); return () => noteEndSubs.delete(f); },
    onSong: (f) => { songSubs.add(f); return () => songSubs.delete(f); },
    setScarecrow: (ids) => { scarecrowIds = (ids && ids.length === 8) ? ids.slice() : null; },
    learnedCount: () => learned.size,
  };

  /* ---------------------------------------------------------------- Start */
  buildSongbook();
  SONGS.forEach((s) => { if (learned.has(s.id)) applyLearned(s.id); });
  updateTally();
  wireControls();
  initTabs();
  // resume audio on first gesture (autoplay policies)
  window.addEventListener('pointerdown', () => synth.ensure(), { once: true });
  window.addEventListener('keydown', () => synth.ensure(), { once: true });
})();
