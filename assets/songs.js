/* ============================================================================
 * Ocarina of Time — note + song data
 * --------------------------------------------------------------------------
 * The magic Ocarina in OoT plays five notes, mapped to the N64 buttons:
 *
 *   Button      Note   Frequency
 *   A           D4     293.66 Hz   (blue button)
 *   C-down  ▼   F4     349.23 Hz   (yellow C buttons)
 *   C-right ▶   A4     440.00 Hz
 *   C-up    ▲   B4     493.88 Hz
 *   C-left  ◀   D5     587.33 Hz
 *
 * Each song is the exact in-game button sequence. Every note is written as
 * [button, beats] so the melody carries rhythm: 0.5 = eighth, 1 = quarter,
 * 2 = half, 3 = dotted half. `bpm` sets the tempo for the auto-player.
 * ==========================================================================*/

window.OOT = window.OOT || {};

// Authentic N64 colours: the A button is blue, the four C buttons are yellow.
const C_GOLD = '#f6c61f';
const A_BLUE = '#5b86ff';

OOT.NOTES = {
  A:     { id: 'A',     arrow: 'A', pitch: 'D4', freq: 293.66, color: A_BLUE, code: 'KeyA',       key: 'A' },
  down:  { id: 'down',  arrow: '▼', pitch: 'F4', freq: 349.23, color: C_GOLD, code: 'ArrowDown',  key: '↓' },
  right: { id: 'right', arrow: '▶', pitch: 'A4', freq: 440.00, color: C_GOLD, code: 'ArrowRight', key: '→' },
  up:    { id: 'up',    arrow: '▲', pitch: 'B4', freq: 493.88, color: C_GOLD, code: 'ArrowUp',    key: '↑' },
  left:  { id: 'left',  arrow: '◀', pitch: 'D5', freq: 587.33, color: C_GOLD, code: 'ArrowLeft',  key: '←' },
};

// Render / layout order (matches the controller: A then the C diamond)
OOT.NOTE_ORDER = ['A', 'down', 'right', 'up', 'left'];

// Vertical position of each note's head on a treble staff (5 lines at y=20..60).
// E4 sits on the bottom line; each diatonic step is 5px.
OOT.STAFF_Y = { A: 65, down: 55, right: 45, up: 40, left: 30 };

OOT.SONGS = [
  // ---- Core ocarina songs --------------------------------------------------
  {
    id: 'lullaby', name: "Zelda's Lullaby", nameKo: '젤다의 자장가', group: 'core', bpm: 84,
    notes: [['left', 1], ['up', 1], ['right', 2], ['left', 1], ['up', 1], ['right', 2]],
    effect: 'Proof of the royal family — opens royal seals and secrets.',
  },
  {
    id: 'epona', name: "Epona's Song", nameKo: '에포나의 노래', group: 'core', bpm: 110,
    notes: [['up', 2], ['left', 1], ['right', 1], ['up', 2], ['left', 1], ['right', 1]],
    effect: 'Calls the horse Epona to your side.',
  },
  {
    id: 'saria', name: "Saria's Song", nameKo: '사리아의 노래', group: 'core', bpm: 132,
    notes: [['down', 0.5], ['right', 0.5], ['left', 1], ['down', 0.5], ['right', 0.5], ['left', 1]],
    effect: 'Speak with Saria, and lift weary hearts.',
  },
  {
    id: 'suns', name: "Sun's Song", nameKo: '태양의 노래', group: 'core', bpm: 100,
    notes: [['right', 1], ['down', 1], ['up', 2], ['right', 1], ['down', 1], ['up', 2]],
    effect: 'Turns night to day (and day to night). Freezes ReDeads.',
  },
  {
    id: 'time', name: 'Song of Time', nameKo: '시간의 노래', group: 'core', bpm: 72,
    notes: [['right', 2], ['A', 1], ['down', 3], ['right', 2], ['A', 1], ['down', 3]],
    effect: 'Opens the Door of Time and shifts Time Blocks.',
  },
  {
    id: 'storms', name: 'Song of Storms', nameKo: '폭풍의 노래', group: 'core', bpm: 120,
    notes: [['A', 0.5], ['down', 0.5], ['up', 2], ['A', 0.5], ['down', 0.5], ['up', 2]],
    effect: 'Summons a downpour and fills dried-up wells.',
  },

  // ---- Warp songs ----------------------------------------------------------
  {
    id: 'minuet', name: 'Minuet of Forest', nameKo: '숲의 미뉴에트', group: 'warp', accent: '#5cc46a', bpm: 96,
    notes: [['A', 2], ['up', 1], ['left', 1], ['right', 1], ['left', 1], ['right', 2]],
    effect: 'Warp to the Sacred Forest Meadow (Forest Temple).',
  },
  {
    id: 'bolero', name: 'Bolero of Fire', nameKo: '불의 볼레로', group: 'warp', accent: '#e9603f', bpm: 116,
    notes: [['down', 1], ['A', 1], ['down', 1], ['A', 1], ['right', 1], ['down', 1], ['right', 1], ['down', 2]],
    effect: 'Warp to the Death Mountain Crater (Fire Temple).',
  },
  {
    id: 'serenade', name: 'Serenade of Water', nameKo: '물의 세레나데', group: 'warp', accent: '#4ea3e8', bpm: 84,
    notes: [['A', 2], ['down', 1], ['right', 1], ['right', 1], ['left', 3]],
    effect: 'Warp to Lake Hylia (Water Temple).',
  },
  {
    id: 'requiem', name: 'Requiem of Spirit', nameKo: '영혼의 레퀴엠', group: 'warp', accent: '#e8b24e', bpm: 80,
    notes: [['A', 1], ['down', 1], ['A', 2], ['right', 1], ['down', 1], ['A', 2]],
    effect: 'Warp to the Desert Colossus (Spirit Temple).',
  },
  {
    id: 'nocturne', name: 'Nocturne of Shadow', nameKo: '그림자의 녹턴', group: 'warp', accent: '#9b6fe0', bpm: 76,
    notes: [['left', 1], ['right', 1], ['right', 1], ['A', 2], ['left', 1], ['right', 1], ['down', 3]],
    effect: 'Warp to the Kakariko Graveyard (Shadow Temple).',
  },
  {
    id: 'prelude', name: 'Prelude of Light', nameKo: '빛의 전주곡', group: 'warp', accent: '#f0d860', bpm: 92,
    notes: [['up', 1], ['right', 1], ['up', 1], ['right', 1], ['left', 2], ['up', 2]],
    effect: 'Warp to the Temple of Time.',
  },
];
