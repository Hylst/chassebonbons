export type Spr = HTMLCanvasElement;

function cv(w: number, h: number): Spr {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function fromRows(rows: string[], pal: Record<string, string>): Spr {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const c = cv(w, h);
  const g = c.getContext('2d')!;
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const col = pal[r[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return c;
}

function flipH(src: Spr): Spr {
  const c = cv(src.width, src.height);
  const g = c.getContext('2d')!;
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/* ---------------- Enfant ---------------- */
const KID_PAL = {
  K: '#1b0f2b',
  G: '#58b030',
  O: '#ff8a1f',
  D: '#c2540a',
  S: '#ffd3ad',
  E: '#1b0f2b',
  W: '#ffffff',
  R: '#e02a4f',
  M: '#5a34b8',
};
const KID_TOP = [
  '.....GG.....',
  '....KGGK....',
  '..KKKOOKKK..',
  '.KOOOOOOOOK.',
  '.KOODOOODOK.',
  '.KKKKKKKKKK.',
  '..KSSSSSSK..',
  '..KSESSESK..',
  '..KSSSSSSK..',
  '..KSSWWSSK..',
  'RRKKKKKKKKRR',
  'RRKMMMMMMKRR',
  'RKKMMMMMMKKR',
  '..KMMMMMMK..',
];
const KID_UP = [...KID_TOP, '..KKWKKWKK..', '...KK..KK...'];
const KID_DOWN = [...KID_TOP, '.KKW.KK.WKK.', '.KK......KK.'];

/* ---------------- Ennemis ---------------- */
const BAT_PAL = { K: '#6a3ca8', Y: '#ff3b3b', W: '#ffffff' };
const BAT_A = [
  'K..............K',
  'KK....K..K....KK',
  'KKK..KKKKKK..KKK',
  'KKKKKKKKKKKKKKKK',
  '.KKKKKYKKYKKKKK.',
  '..KK.KKKKKK.KK..',
  '...K..W..W..K...',
];
const BAT_B = [
  '................',
  '.....K....K.....',
  '....KKK..KKK....',
  '.KKKKKKKKKKKKKK.',
  'KKKKKKYKKYKKKKKK',
  'KK.KKKKKKKKKK.KK',
  'K...KKW..WKK...K',
];
const GHOST_PAL = { W: '#eaf6ff', K: '#1b0f2b', L: '#a9d4f5' };
const GHOST = [
  '....WWWWWW....',
  '..WWWWWWWWWW..',
  '.WWWWWWWWWWWW.',
  '.WWKKWWWWKKWW.',
  '.WWKKWWWWKKWW.',
  '.WWWWWWWWWWWL.',
  '.WWWWKKKKWWWL.',
  '.WWWWKKKKWWWL.',
  '.WWWWWWWWWWLL.',
  'WWWWWWWWWWWWWL',
  '.WWWWWWWWWWLL.',
  '.WWWWWWWWWLLL.',
  '.WW.WWWWWL.LL.',
  '.W...WWWL...L.',
];

/* ---------------- Bonbons & bonus ---------------- */
const WRAP = [
  'R..........R',
  'RR.PPPPPP.RR',
  'RRRPWWPPPRRR',
  'RR.PPPPPP.RR',
  'R..........R',
];
const WRAP_PALS = [
  { R: '#ff4fa3', P: '#ff9fd0', W: '#ffffff' },
  { R: '#3fd0ff', P: '#2a7fe0', W: '#ffffff' },
  { R: '#ffe14d', P: '#ff9a1f', W: '#ffffff' },
];
const LOLLI = [
  '..RRRRR..',
  '.RWWWWWR.',
  'RWWRRRWWR',
  'RWRWWWRWR',
  'RWRWRWRWR',
  'RWRWWWRWR',
  'RWWRRRWWR',
  '.RWWWWWR.',
  '..RRRRR..',
  '....S....',
  '....S....',
  '....S....',
];
const CORN = [
  '...WW...',
  '..WWWW..',
  '.YYYYYY.',
  '.YYYYYY.',
  'OOOOOOOO',
  'OOOOOOOO',
];
const POTION = [
  '...CCCC...',
  '....KK....',
  '....KK....',
  '...KKKK...',
  '..KBBBBK..',
  '.KBBLBBBK.',
  '.KBLBBBBK.',
  '.KBBBBBBK.',
  '.KBBBBBBK.',
  '..KKKKKK..',
];
const STAR = [
  '.....Y.....',
  '.....Y.....',
  '....YYY....',
  'YYYYYYYYYYY',
  '.YYYYYYYYY.',
  '..YYYWYYY..',
  '...YYYYY...',
  '..YYYYYYY..',
  '..YYY.YYY..',
  '.YY.....YY.',
  'YY.......YY',
];

/* ---------------- Plateformes ---------------- */
function roof(w: number, c: { base: string; line: string; hi: string; bot: string }, lantern: boolean): Spr {
  const h = 9;
  const s = cv(w, h);
  const g = s.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((y === 0 && (x === 0 || x === w - 1)) || (y === h - 1 && (x < 2 || x > w - 3))) continue;
      let col: string;
      if (y === 0) col = c.hi;
      else if (y >= h - 2) col = c.bot;
      else {
        const row = Math.floor((y - 1) / 3);
        const lx = (x + (row % 2) * 4) % 8;
        col = lx === 0 || (y - 1) % 3 === 2 ? c.line : c.base;
      }
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  if (lantern) {
    g.fillStyle = '#ffe14d';
    g.fillRect(2, 3, 2, 2);
    g.fillRect(w - 4, 3, 2, 2);
  }
  return s;
}

function branch(w: number, crumble: boolean): Spr {
  const h = 11;
  const s = cv(w, h);
  const g = s.getContext('2d')!;
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const base = crumble ? '#8c7b66' : '#6b4423';
  const hi = crumble ? '#b5a58e' : '#9a6a3a';
  const dark = crumble ? '#4d4235' : '#3d2512';
  for (let x = 0; x < w; x++) {
    const t = 6 - Math.floor((x * 3) / w);
    for (let y = 0; y < t; y++) {
      let col = base;
      if (y === 0) col = !crumble && (x * 3) % 11 === 0 ? '#5fae35' : hi;
      else if (y === t - 1) col = dark;
      else if ((x * 7 + y * 5) % 13 === 0) col = dark;
      px(x, y, col);
    }
  }
  const twigs: [number, number][] = [
    [6, 3],
    [w - 12, 2],
    [Math.floor(w / 2), 4],
  ];
  for (const [tx, len] of twigs) {
    for (let i = 0; i < len; i++) px(tx, 6 + i, dark);
    if (!crumble) {
      px(tx - 1, 5 + len, '#e0792a');
      px(tx + 1, 5 + len, '#c4570b');
    }
  }
  if (crumble) {
    for (const cx of [Math.floor(w * 0.33), Math.floor(w * 0.66)]) {
      for (let y = 0; y < 6; y++) g.clearRect(cx + (y % 2), y, 1, 1);
    }
  }
  return s;
}

function pumpkin(): Spr {
  const w = 40;
  const h = 22;
  const s = cv(w, h);
  const g = s.getContext('2d')!;
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - 20) / 19.5;
      const dy = (y + 0.5 - 13) / 9;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      let col = '#ff8a1f';
      if (d > 0.8) col = '#8a3406';
      else {
        const onRidge = [-0.62, -0.3, 0, 0.3, 0.62].some((r) => Math.abs(dx - r * (1 - 0.25 * dy * dy)) < 0.035);
        if (onRidge) col = '#c4570b';
        else if (dy > 0.35 || dx > 0.55) col = '#ee6f10';
        else if (dx < -0.25 && dy < -0.25) col = '#ffb04a';
      }
      px(x, y, col);
    }
  }
  g.fillStyle = '#3f7d22';
  g.fillRect(18, 0, 4, 5);
  g.fillStyle = '#5aa832';
  g.fillRect(18, 0, 2, 4);
  g.fillRect(21, 0, 3, 1);
  // visage de citrouille
  g.fillStyle = '#ffe14d';
  for (const cx of [13, 27]) {
    g.fillRect(cx, 11, 1, 1);
    g.fillRect(cx - 1, 12, 3, 1);
    g.fillRect(cx - 2, 13, 5, 1);
  }
  g.fillRect(13, 16, 14, 2);
  g.fillRect(15, 18, 10, 1);
  g.fillStyle = '#ff8a1f';
  g.fillRect(16, 16, 2, 1);
  g.fillRect(22, 17, 2, 1);
  return s;
}

/* ---------------- Décor ---------------- */
function moon(): Spr {
  const r = 21;
  const s = cv(r * 2 + 2, r * 2 + 2);
  const g = s.getContext('2d')!;
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const dx = x + 0.5 - (r + 1);
      const dy = y + 0.5 - (r + 1);
      if (dx * dx + dy * dy <= r * r) {
        g.fillStyle = dx + dy > 14 ? '#e3d59b' : '#fff3c4';
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  g.fillStyle = '#dccb8a';
  for (const [cx, cy, cw] of [
    [12, 14, 6],
    [28, 24, 8],
    [18, 32, 4],
    [30, 10, 3],
  ]) {
    g.fillRect(cx, cy, cw, Math.max(2, cw - 2));
  }
  return s;
}

function house(): Spr {
  const s = cv(76, 66);
  const g = s.getContext('2d')!;
  g.fillStyle = '#120826';
  g.fillRect(2, 28, 42, 38);
  for (let i = 0; i < 19; i++) {
    const half = Math.round(3 + i * 1.2);
    g.fillRect(23 - half, 10 + i, half * 2, 1);
  }
  g.fillRect(46, 14, 20, 52);
  for (let i = 0; i < 14; i++) {
    const half = Math.round(1 + i * 0.75);
    g.fillRect(56 - half, i, half * 2, 1);
  }
  g.fillRect(33, 4, 5, 14);
  g.fillStyle = '#ffd24d';
  g.fillRect(8, 36, 6, 8);
  g.fillRect(30, 36, 6, 8);
  g.fillRect(53, 24, 5, 8);
  g.fillRect(53, 44, 5, 8);
  g.fillRect(21, 17, 4, 5);
  g.fillStyle = '#05010f';
  g.fillRect(19, 52, 9, 14);
  return s;
}

function tree(): Spr {
  const s = cv(44, 64);
  const g = s.getContext('2d')!;
  g.fillStyle = '#120826';
  const line = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      g.fillRect(x, y, t, t);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  };
  g.fillRect(19, 30, 6, 34);
  g.fillRect(16, 58, 12, 6);
  line(21, 36, 6, 18, 2);
  line(10, 22, 2, 20, 1);
  line(8, 20, 8, 8, 1);
  line(22, 28, 36, 10, 2);
  line(32, 15, 42, 14, 1);
  line(30, 17, 28, 4, 1);
  line(21, 24, 22, 2, 2);
  return s;
}

/* ---------------- Export ---------------- */
export interface Sprites {
  kid: { up: [Spr, Spr]; down: [Spr, Spr] };
  bat: Spr[];
  ghost: Spr;
  wraps: Spr[];
  lolli: Spr;
  corn: Spr;
  potion: Spr;
  star: Spr;
  pumpkin: Spr;
  moon: Spr;
  house: Spr;
  tree: Spr;
  plat: (kind: 'roof' | 'branch' | 'move' | 'crumble', w: number) => Spr;
}

export function buildSprites(): Sprites {
  const kidUp = fromRows(KID_UP, KID_PAL);
  const kidDown = fromRows(KID_DOWN, KID_PAL);
  const cache = new Map<string, Spr>();
  return {
    kid: { up: [kidUp, flipH(kidUp)], down: [kidDown, flipH(kidDown)] },
    bat: [fromRows(BAT_A, BAT_PAL), fromRows(BAT_B, BAT_PAL)],
    ghost: fromRows(GHOST, GHOST_PAL),
    wraps: WRAP_PALS.map((p) => fromRows(WRAP, p)),
    lolli: fromRows(LOLLI, { R: '#ff3d7f', W: '#fff4fa', S: '#e8e0d0' }),
    corn: fromRows(CORN, { W: '#ffffff', Y: '#ffd633', O: '#ff8c1a' }),
    potion: fromRows(POTION, { C: '#9b6a3a', K: '#1b0f2b', B: '#3fe0ff', L: '#ffffff' }),
    star: fromRows(STAR, { Y: '#ffe14d', W: '#ffffff' }),
    pumpkin: pumpkin(),
    moon: moon(),
    house: house(),
    tree: tree(),
    plat(kind, w) {
      const key = kind + w;
      let s = cache.get(key);
      if (!s) {
        if (kind === 'roof') s = roof(w, { base: '#b5483a', line: '#7a2a26', hi: '#e9806a', bot: '#3d1417' }, false);
        else if (kind === 'move') s = roof(w, { base: '#3a86a8', line: '#235a78', hi: '#8fe0f0', bot: '#12303f' }, true);
        else if (kind === 'branch') s = branch(w, false);
        else s = branch(w, true);
        cache.set(key, s);
      }
      return s;
    },
  };
}
