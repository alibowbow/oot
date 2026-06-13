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
 * Every song below is the exact in-game button sequence.
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
    id: 'lullaby', name: "Zelda's Lullaby", nameKo: '젤다의 자장가', group: 'core',
    notes: ['left', 'up', 'right', 'left', 'up', 'right'],
    effect: 'Proof of the royal family — opens royal seals and secrets.',
  },
  {
    id: 'epona', name: "Epona's Song", nameKo: '에포나의 노래', group: 'core',
    notes: ['up', 'left', 'right', 'up', 'left', 'right'],
    effect: 'Calls the horse Epona to your side.',
  },
  {
    id: 'saria', name: "Saria's Song", nameKo: '사리아의 노래', group: 'core',
    notes: ['down', 'right', 'left', 'down', 'right', 'left'],
    effect: 'Speak with Saria, and lift weary hearts.',
  },
  {
    id: 'suns', name: "Sun's Song", nameKo: '태양의 노래', group: 'core',
    notes: ['right', 'down', 'up', 'right', 'down', 'up'],
    effect: 'Turns night to day (and day to night). Freezes ReDeads.',
  },
  {
    id: 'time', name: 'Song of Time', nameKo: '시간의 노래', group: 'core',
    notes: ['right', 'A', 'down', 'right', 'A', 'down'],
    effect: 'Opens the Door of Time and shifts Time Blocks.',
  },
  {
    id: 'storms', name: 'Song of Storms', nameKo: '폭풍의 노래', group: 'core',
    notes: ['A', 'down', 'up', 'A', 'down', 'up'],
    effect: 'Summons a downpour and fills dried-up wells.',
  },

  // ---- Warp songs ----------------------------------------------------------
  {
    id: 'minuet', name: 'Minuet of Forest', nameKo: '숲의 미뉴에트', group: 'warp', accent: '#5cc46a',
    notes: ['A', 'up', 'left', 'right', 'left', 'right'],
    effect: 'Warp to the Sacred Forest Meadow (Forest Temple).',
  },
  {
    id: 'bolero', name: 'Bolero of Fire', nameKo: '불의 볼레로', group: 'warp', accent: '#e9603f',
    notes: ['down', 'A', 'down', 'A', 'right', 'down', 'right', 'down'],
    effect: 'Warp to the Death Mountain Crater (Fire Temple).',
  },
  {
    id: 'serenade', name: 'Serenade of Water', nameKo: '물의 세레나데', group: 'warp', accent: '#4ea3e8',
    notes: ['A', 'down', 'right', 'right', 'left'],
    effect: 'Warp to Lake Hylia (Water Temple).',
  },
  {
    id: 'requiem', name: 'Requiem of Spirit', nameKo: '영혼의 레퀴엠', group: 'warp', accent: '#e8b24e',
    notes: ['A', 'down', 'A', 'right', 'down', 'A'],
    effect: 'Warp to the Desert Colossus (Spirit Temple).',
  },
  {
    id: 'nocturne', name: 'Nocturne of Shadow', nameKo: '그림자의 녹턴', group: 'warp', accent: '#9b6fe0',
    notes: ['left', 'right', 'right', 'A', 'left', 'right', 'down'],
    effect: 'Warp to the Kakariko Graveyard (Shadow Temple).',
  },
  {
    id: 'prelude', name: 'Prelude of Light', nameKo: '빛의 전주곡', group: 'warp', accent: '#f0d860',
    notes: ['up', 'right', 'up', 'right', 'left', 'up'],
    effect: 'Warp to the Temple of Time.',
  },
];
