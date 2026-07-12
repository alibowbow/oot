/* ============================================================================
 * Ocarina of Time — note + song data
 * --------------------------------------------------------------------------
 * The magic Ocarina in OoT plays five notes, mapped to the N64 buttons:
 *
 *   Button      Note   Frequency
 *   A           D4     293.66 Hz   (blue button)
 *   C-down  ▼   F4     349.23 Hz   (yellow C buttons)
 *   C-right ▶   A4     440.00 Hz
 *   C-left  ◀   B4     493.88 Hz
 *   C-up    ▲   D5     587.33 Hz   (high D, an octave above A)
 *
 * Each song is the exact in-game button sequence. Every note is written as
 * [button, beats] so the melody carries rhythm: 0.5 = eighth, 1 = quarter,
 * 2 = half, 3 = dotted half. `bpm` sets the tempo for the auto-player.
 *
 * `ext` is the melody that CONTINUES past the input phrase — the fuller
 * theme each song comes from (Lost Woods, the windmill, Lon Lon Ranch…),
 * transcribed from the originals and quantized onto the ocarina's five
 * pitches (out-of-range notes snap to the nearest playable one). The song
 * book and practice mode stay input-only; the rhythm game plays the works.
 * ==========================================================================*/

window.OOT = window.OOT || {};

// Authentic N64 colours: the A button is blue, the four C buttons are yellow.
const C_GOLD = '#f6c61f';
const A_BLUE = '#5b86ff';

OOT.NOTES = {
  A:     { id: 'A',     arrow: 'A', pitch: 'D4', freq: 293.66, color: A_BLUE, code: 'KeyA',       key: 'A' },
  down:  { id: 'down',  arrow: '▼', pitch: 'F4', freq: 349.23, color: C_GOLD, code: 'ArrowDown',  key: '↓' },
  right: { id: 'right', arrow: '▶', pitch: 'A4', freq: 440.00, color: C_GOLD, code: 'ArrowRight', key: '→' },
  left:  { id: 'left',  arrow: '◀', pitch: 'B4', freq: 493.88, color: C_GOLD, code: 'ArrowLeft',  key: '←' },
  up:    { id: 'up',    arrow: '▲', pitch: 'D5', freq: 587.33, color: C_GOLD, code: 'ArrowUp',    key: '↑' },
};

// Render / layout order (matches the controller: A then the C diamond)
OOT.NOTE_ORDER = ['A', 'down', 'right', 'up', 'left'];

// Vertical position of each note's head on a treble staff (5 lines at y=20..60).
// E4 sits on the bottom line; each diatonic step is 5px.
OOT.STAFF_Y = { A: 65, down: 55, right: 45, left: 40, up: 30 };

OOT.SONGS = [
  // ---- Core ocarina songs --------------------------------------------------
  {
    id: 'lullaby', name: "Zelda's Lullaby", nameKo: '젤다의 자장가', group: 'core', bpm: 120,
    // 3/4 waltz: B (half) · D5 (quarter) · A (held), repeated
    notes: [['left', 2], ['up', 1], ['right', 3], ['left', 2], ['up', 1], ['right', 3]],
    // Zelda's theme continues: (G)A A·B·D5·A | B·D5·(A5 G5→)D5·B | D5·(C5→)B·A
    ext: [
      ['right', 0.5], ['right', 0.5], ['left', 1], ['up', 1], ['right', 3],
      ['left', 1], ['up', 1], ['up', 1], ['left', 1],
      ['up', 1], ['left', 1], ['right', 3],
    ],
    effect: 'Proof of the royal family — opens royal seals and secrets.',
  },
  {
    id: 'epona', name: "Epona's Song", nameKo: '에포나의 노래', group: 'core', bpm: 116,
    // 1·1·6 rhythm: two eighths then a held (dotted-half) note, repeated
    notes: [['up', 0.5], ['left', 0.5], ['right', 3], ['up', 0.5], ['left', 0.5], ['right', 3]],
    // Lon Lon Ranch continues: D5·B·A·B·A·F~ | (E→)D·F·(C5→)B·D5 | D5·D5·B·A~
    ext: [
      ['up', 0.5], ['left', 0.5], ['right', 1], ['left', 0.5], ['right', 0.5], ['down', 3],
      ['A', 0.5], ['down', 0.5], ['left', 1], ['up', 2],
      ['up', 0.5], ['up', 0.5], ['left', 1], ['right', 3],
    ],
    effect: 'Calls the horse Epona to your side.',
  },
  {
    id: 'saria', name: "Saria's Song", nameKo: '사리아의 노래', group: 'core', bpm: 132,
    notes: [['down', 0.5], ['right', 0.5], ['left', 1], ['down', 0.5], ['right', 0.5], ['left', 1]],
    // Lost Woods continues: F·A·B·(E5→)D5·D5 | B·(C5→)D5·B·(G→)A·(E→)D | D·F·A·F~
    ext: [
      ['down', 0.5], ['right', 0.5], ['left', 0.5], ['up', 0.5], ['up', 1],
      ['left', 0.5], ['up', 0.5], ['left', 0.5], ['right', 0.5], ['A', 1],
      ['A', 0.5], ['down', 0.5], ['right', 0.5], ['down', 1.5],
    ],
    effect: 'Speak with Saria, and lift weary hearts.',
  },
  {
    id: 'suns', name: "Sun's Song", nameKo: '태양의 노래', group: 'core', bpm: 114,
    notes: [['right', 1], ['down', 1], ['up', 2], ['right', 1], ['down', 1], ['up', 2]],
    // playback answers with the motif in double time, then the sunrise rise
    ext: [
      ['right', 0.5], ['down', 0.5], ['up', 1],
      ['right', 0.5], ['down', 0.5], ['up', 1],
      ['right', 0.5], ['left', 0.5], ['up', 2],
    ],
    effect: 'Turns night to day (and day to night). Freezes ReDeads.',
  },
  {
    id: 'time', name: 'Song of Time', nameKo: '시간의 노래', group: 'core', bpm: 144,
    // 2·4·2 rhythm: quarter · half · quarter, repeated
    notes: [['right', 1], ['A', 2], ['down', 1], ['right', 1], ['A', 2], ['down', 1]],
    // the theme continues: F·A·B·(G→)A | F·A~ | D·(C→)D·(E→)F·D~
    ext: [
      ['down', 1], ['right', 1], ['left', 1], ['right', 1],
      ['down', 0.5], ['right', 2.5],
      ['A', 1], ['A', 0.5], ['down', 0.5], ['A', 2],
    ],
    effect: 'Opens the Door of Time and shifts Time Blocks.',
  },
  {
    id: 'storms', name: 'Song of Storms', nameKo: '폭풍의 노래', group: 'core', bpm: 138,
    notes: [['A', 0.5], ['down', 0.5], ['up', 2], ['A', 0.5], ['down', 0.5], ['up', 2]],
    // the windmill turns: (E5·F5 wiggle→)D5·B ×3 →A~ | A·D·F·(G→)A~ | A·D·F·(E→)D~
    ext: [
      ['up', 0.5], ['left', 0.5], ['up', 0.5], ['left', 0.5], ['up', 0.5], ['left', 0.5], ['right', 2],
      ['right', 0.5], ['A', 0.5], ['down', 0.5], ['right', 2],
      ['right', 0.5], ['A', 0.5], ['down', 0.5], ['A', 2],
    ],
    effect: 'Summons a downpour and fills dried-up wells.',
  },

  // ---- Warp songs ----------------------------------------------------------
  {
    id: 'minuet', name: 'Minuet of Forest', nameKo: '숲의 미뉴에트', group: 'warp', accent: '#5cc46a', bpm: 112,
    notes: [['A', 2], ['up', 1], ['left', 1], ['right', 1], ['left', 1], ['right', 2]],
    effect: 'Warp to the Sacred Forest Meadow (Forest Temple).',
  },
  {
    id: 'bolero', name: 'Bolero of Fire', nameKo: '불의 볼레로', group: 'warp', accent: '#e9603f', bpm: 116,
    notes: [['down', 1], ['A', 1], ['down', 1], ['A', 1], ['right', 1], ['down', 1], ['right', 1], ['down', 2]],
    effect: 'Warp to the Death Mountain Crater (Fire Temple).',
  },
  {
    id: 'serenade', name: 'Serenade of Water', nameKo: '물의 세레나데', group: 'warp', accent: '#4ea3e8', bpm: 106,
    notes: [['A', 2], ['down', 1], ['right', 1], ['right', 1], ['left', 3]],
    effect: 'Warp to Lake Hylia (Water Temple).',
  },
  {
    id: 'requiem', name: 'Requiem of Spirit', nameKo: '영혼의 레퀴엠', group: 'warp', accent: '#e8b24e', bpm: 104,
    notes: [['A', 1], ['down', 1], ['A', 2], ['right', 1], ['down', 1], ['A', 2]],
    effect: 'Warp to the Desert Colossus (Spirit Temple).',
  },
  {
    id: 'nocturne', name: 'Nocturne of Shadow', nameKo: '그림자의 녹턴', group: 'warp', accent: '#9b6fe0', bpm: 100,
    notes: [['left', 1], ['right', 1], ['right', 1], ['A', 2], ['left', 1], ['right', 1], ['down', 3]],
    effect: 'Warp to the Kakariko Graveyard (Shadow Temple).',
  },
  {
    id: 'prelude', name: 'Prelude of Light', nameKo: '빛의 전주곡', group: 'warp', accent: '#f0d860', bpm: 110,
    notes: [['up', 1], ['right', 1], ['up', 1], ['right', 1], ['left', 2], ['up', 2]],
    effect: 'Warp to the Temple of Time.',
  },
];
