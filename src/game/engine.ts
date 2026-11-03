import { buildSprites, type Spr, type Sprites } from './sprites';
import { audio } from './audio';

export const W = 192;
export const H = 320;

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export interface Hud {
  score: number;
  height: number;
  candies: number;
  mult: number;
  chainFrac: number;
  shield: boolean;
  rush: number;
}

export interface OverInfo {
  score: number;
  candies: number;
  height: number;
  stomps: number;
}

interface Callbacks {
  onHud: (h: Hud) => void;
  onState: (s: GameState) => void;
  onOver: (i: OverInfo) => void;
}

const STEP = 1 / 60;
const GRAV = 700;
const JUMP = 365;
const BOUNCE = 530;
const MOVE = 135;
const RUSH_TIME = 1.9;

type PKind = 'solid' | 'move' | 'crumble' | 'pumpkin';
interface Plat {
  x: number;
  y: number;
  w: number;
  kind: PKind;
  skin: 'roof' | 'branch';
  dir: number;
  spd: number;
  st: 0 | 1 | 2;
  t: number;
  vy: number;
  sq: number;
}
interface Candy {
  x: number;
  y: number;
  type: number;
  t: number;
}
interface Enemy {
  kind: 'bat' | 'ghost';
  x: number;
  y: number;
  vx: number;
  vy: number;
  base: number;
  t: number;
}
interface Power {
  x: number;
  y: number;
  kind: 'shield' | 'rush';
  t: number;
}
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  size: number;
  g: number;
}
interface Pop {
  x: number;
  y: number;
  text: string;
  life: number;
  col: string;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

export class Game {
  state: GameState = 'menu';
  private ctx: CanvasRenderingContext2D;
  private spr: Sprites;
  private cb: Callbacks;
  private held: Record<string, boolean> = {};
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private demo = true;

  private scroll = 0;
  private topY = 0;
  private lastMain: Plat | null = null;
  private plats: Plat[] = [];
  private candies: Candy[] = [];
  private enemies: Enemy[] = [];
  private powers: Power[] = [];
  private parts: Part[] = [];
  private pops: Pop[] = [];

  private p = {
    x: W / 2,
    y: 0,
    vx: 0,
    vy: 0,
    face: 1,
    squash: 0,
    alive: true,
    deadT: 0,
    rot: 0,
    inv: 0,
    shield: false,
    rush: 0,
  };
  private bonus = 0;
  private candyCount = 0;
  private stomps = 0;
  private chain = 0;
  private chainT = 0;
  private shake = 0;
  private flash = 0;
  private flashCol = '#fff';
  private rowsSinceEnemy = 0;
  private powerCd = 0;
  private hudKey = '';
  private demoBest = 0;
  private demoIdle = 0;

  private stars: { x: number; y: number; f: number; tw: number }[] = [];
  private clouds: { x: number; y: number; w: number; f: number; v: number }[] = [];

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.cb = cb;
    this.spr = buildSprites();
    for (let i = 0; i < 70; i++) {
      this.stars.push({ x: rand(0, W), y: rand(0, H), f: Math.random() < 0.5 ? 0.04 : 0.1, tw: rand(0, 6) });
    }
    for (let i = 0; i < 5; i++) {
      this.clouds.push({ x: rand(0, W), y: rand(0, H), w: rand(40, 80), f: rand(0.15, 0.3), v: rand(2, 7) });
    }
    this.reset(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------- API publique ---------- */
  destroy() {
    cancelAnimationFrame(this.raf);
    audio.stopMusic();
  }

  setHeld(name: string, on: boolean) {
    this.held[name] = on;
  }

  clearHeld() {
    this.held = {};
  }

  start() {
    this.reset(false);
    this.state = 'playing';
    audio.ensure();
    audio.sfx('start');
    audio.startMusic();
    this.cb.onState('playing');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    audio.stopMusic();
    this.clearHeld();
    this.cb.onState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    audio.startMusic();
    this.last = performance.now();
    this.cb.onState('playing');
  }

  toMenu() {
    this.reset(true);
    this.state = 'menu';
    audio.stopMusic();
    this.cb.onState('menu');
  }

  /* ---------- Initialisation du monde ---------- */
  private reset(demo: boolean) {
    this.demo = demo;
    this.scroll = 0;
    this.plats = [];
    this.candies = [];
    this.enemies = [];
    this.powers = [];
    this.parts = [];
    this.pops = [];
    this.bonus = 0;
    this.candyCount = 0;
    this.stomps = 0;
    this.chain = 0;
    this.chainT = 0;
    this.shake = 0;
    this.flash = 0;
    this.rowsSinceEnemy = 0;
    this.powerCd = 0;
    const start: Plat = {
      x: W / 2 - 32,
      y: H - 60,
      w: 64,
      kind: 'solid',
      skin: 'roof',
      dir: 1,
      spd: 0,
      st: 0,
      t: 0,
      vy: 0,
      sq: 0,
    };
    this.plats.push(start);
    this.lastMain = start;
    this.topY = start.y;
    const p = this.p;
    p.x = W / 2;
    p.y = start.y;
    p.vx = 0;
    p.vy = -JUMP;
    p.face = 1;
    p.squash = 0;
    p.alive = true;
    p.deadT = 0;
    p.rot = 0;
    p.inv = 0;
    p.shield = false;
    p.rush = 0;
    this.fill();
    this.hudKey = '';
    this.demoBest = 0;
    this.demoIdle = 0;
  }

  private diff() {
    return Math.min(1, this.scroll / 7000);
  }

  private fill() {
    while (this.topY > -60) this.spawnRow();
  }

  private spawnRow() {
    const d = this.diff();
    const gap = rand(26, 42 + d * 40);
    const w = d > 0.7 ? 32 : d > 0.35 ? 36 : 40;
    const y = this.topY - gap;
    const x = rand(4, W - w - 4);
    const r = Math.random();
    let kind: PKind = 'solid';
    if (r < 0.09) kind = 'pumpkin';
    else if (this.scroll > 500 && r < 0.15 + d * 0.25) kind = 'move';
    const pl: Plat = {
      x,
      y,
      w: kind === 'pumpkin' ? 40 : w,
      kind,
      skin: Math.random() < 0.55 ? 'roof' : 'branch',
      dir: Math.random() < 0.5 ? 1 : -1,
      spd: kind === 'move' ? rand(25, 45) + d * 30 : 0,
      st: 0,
      t: 0,
      vy: 0,
      sq: 0,
    };
    this.plats.push(pl);
    const prev = this.lastMain;
    this.lastMain = pl;
    this.topY = y;

    // plateforme fragile en bonus
    if (Math.random() < 0.12 + d * 0.16) {
      const side = x < W / 2 ? 1 : -1;
      const cx = clamp(x + side * rand(52, 80), 4, W - w - 4);
      if (Math.abs(cx - x) > w + 8) {
        this.plats.push({
          x: cx,
          y: y + rand(-14, 14),
          w,
          kind: 'crumble',
          skin: 'branch',
          dir: 1,
          spd: 0,
          st: 0,
          t: 0,
          vy: 0,
          sq: 0,
        });
      }
    }

    // bonbons
    const cxm = pl.x + pl.w / 2;
    if (kind === 'pumpkin' && Math.random() < 0.8) {
      for (let i = 0; i < 4; i++) this.candies.push({ x: cxm, y: y - 40 - i * 28, type: i % 4, t: rand(0, 6) });
    } else if (Math.random() < 0.38) {
      this.candies.push({ x: cxm + rand(-8, 8), y: y - 14 - rand(0, 10), type: Math.floor(rand(0, 4)), t: rand(0, 6) });
    }
    if (prev && Math.random() < 0.12) {
      const ax = prev.x + prev.w / 2;
      const ay = prev.y - 18;
      const type = Math.floor(rand(0, 4));
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        this.candies.push({
          x: lerp(ax, cxm, t),
          y: lerp(ay, y - 18, t) - Math.sin(t * Math.PI) * 14,
          type,
          t: i,
        });
      }
    }

    // ennemis
    this.rowsSinceEnemy++;
    if (this.scroll > 250 && this.rowsSinceEnemy >= 3 && Math.random() < 0.12 + d * 0.18) {
      this.rowsSinceEnemy = 0;
      this.enemies.push({
        kind: 'bat',
        x: rand(20, W - 20),
        y: y + gap / 2,
        vx: (Math.random() < 0.5 ? 1 : -1) * (rand(25, 45) + d * 25),
        vy: 0,
        base: y + gap / 2,
        t: rand(0, 6),
      });
    }
    const ghosts = this.enemies.filter((e) => e.kind === 'ghost').length;
    if (this.scroll > 1200 && ghosts < 2 && Math.random() < 0.04 + d * 0.06) {
      this.enemies.push({
        kind: 'ghost',
        x: Math.random() < 0.5 ? -10 : W + 10,
        y: y - 70,
        vx: 0,
        vy: 0,
        base: 0,
        t: rand(0, 6),
      });
    }

    // bonus
    this.powerCd--;
    if (this.scroll > 350 && this.powerCd <= 0 && Math.random() < 0.05) {
      this.powerCd = 14;
      this.powers.push({ x: cxm, y: y - 20, kind: Math.random() < 0.62 ? 'shield' : 'rush', t: 0 });
    }
  }

  /* ---------- Boucle ---------- */
  private loop = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.render();
    this.emitHud();
    this.raf = requestAnimationFrame(this.loop);
  };

  private sfx(name: string, n = 0) {
    if (this.state === 'playing') audio.sfx(name, n);
  }

  private inputDir(): number {
    const h = this.held;
    const l = h.kl || h.tl || h.bl;
    const r = h.kr || h.tr || h.br;
    return (r ? 1 : 0) - (l ? 1 : 0);
  }

  private aiDir(): number {
    const p = this.p;
    let best: Plat | null = null;
    let bestKey = -1e9;
    let bestDx = 0;
    for (const pl of this.plats) {
      if (pl.kind === 'crumble') continue;
      const apex = p.vy < 0 ? p.y - (p.vy * p.vy) / (2 * GRAV) + 4 : p.y - 4;
      const ok = pl.y >= apex && pl.y <= p.y + 140;
      if (!ok) continue;
      let dx = pl.x + pl.w / 2 - p.x;
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      const disc = p.vy * p.vy + 2 * GRAV * (pl.y - p.y);
      const tf = (-p.vy + Math.sqrt(Math.max(0, disc))) / GRAV;
      const feasible = Math.abs(dx) - (pl.w / 2 - 3) <= MOVE * tf * 0.8;
      // les plateformes atteignables les plus hautes d'abord
      const key = (feasible ? 1000 : 0) - pl.y - Math.abs(dx) * 0.05 - (feasible ? 0 : Math.abs(dx) * 5);
      if (key > bestKey) {
        bestKey = key;
        best = pl;
        bestDx = dx;
      }
    }
    if (!best) return 0;
    return bestDx > 4 ? 1 : bestDx < -4 ? -1 : 0;
  }

  private step(dt: number) {
    if (this.state === 'paused') return;
    this.time += dt;
    this.updateFx(dt);
    if (this.state === 'over') return;

    const p = this.p;

    // timers
    this.chainT -= dt;
    if (this.chainT <= 0) this.chain = 0;
    p.inv = Math.max(0, p.inv - dt);
    p.squash = Math.max(0, p.squash - dt);

    // plateformes (animation)
    for (const pl of this.plats) {
      pl.sq = Math.max(0, pl.sq - dt);
      if (pl.kind === 'move') {
        pl.x += pl.dir * pl.spd * dt;
        if (pl.x < 2) {
          pl.x = 2;
          pl.dir = 1;
        } else if (pl.x + pl.w > W - 2) {
          pl.x = W - 2 - pl.w;
          pl.dir = -1;
        }
      } else if (pl.kind === 'crumble') {
        if (pl.st === 1) {
          pl.t -= dt;
          if (pl.t <= 0) {
            pl.st = 2;
            this.sfx('crumble');
            this.burst(pl.x + pl.w / 2, pl.y + 3, 8, ['#8c7b66', '#b5a58e', '#4d4235'], 40, 0.5, 200);
          }
        } else if (pl.st === 2) {
          pl.vy += GRAV * dt;
          pl.y += pl.vy * dt;
        }
      }
    }

    // ennemis
    for (const e of this.enemies) {
      e.t += dt;
      if (e.kind === 'bat') {
        e.x += e.vx * dt;
        if (e.x < 8 || e.x > W - 8) {
          e.vx *= -1;
          e.x = clamp(e.x, 8, W - 8);
        }
        e.y = e.base + Math.sin(e.t * 3) * 8;
      } else {
        const tx = p.x - e.x;
        const ty = p.y - 8 - e.y;
        const len = Math.hypot(tx, ty) || 1;
        const sp = 22 + this.diff() * 14;
        e.vx = lerp(e.vx, (tx / len) * sp, Math.min(1, dt * 2));
        e.vy = lerp(e.vy, (ty / len) * sp, Math.min(1, dt * 2));
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
    }
    for (const c of this.candies) c.t += dt;
    for (const pw of this.powers) pw.t += dt;

    if (!p.alive) {
      p.deadT += dt;
      p.vy += GRAV * dt;
      p.y += p.vy * dt;
      p.rot += 10 * dt;
      if (p.y > H + 40 && p.deadT > 0.5) this.finish();
      this.cleanup();
      return;
    }

    if (this.demo) {
      if (this.scroll > this.demoBest + 1) {
        this.demoBest = this.scroll;
        this.demoIdle = 0;
      } else this.demoIdle += dt;
      if (this.demoIdle > 8 || this.scroll > 3500) {
        this.reset(true);
        return;
      }
    }

    // contrôle horizontal
    const dir = this.demo ? this.aiDir() : this.inputDir();
    p.vx += (dir * MOVE - p.vx) * Math.min(1, 12 * dt);
    p.x += p.vx * dt;
    if (p.x < -4) p.x += W + 8;
    if (p.x > W + 4) p.x -= W + 8;
    if (dir !== 0) p.face = dir;

    // vertical
    const prevY = p.y;
    if (p.rush > 0) {
      p.rush -= dt;
      p.vy = -430;
      this.burst(p.x, p.y, 2, ['#ffe14d', '#ff8a1f', '#ff4d00'], 60, 0.4, 150, 1, 90);
      if (p.rush <= 0) {
        p.rush = 0;
        p.vy = -180;
        p.inv = 1;
      }
    } else {
      p.vy += GRAV * dt;
    }
    p.y += p.vy * dt;

    // atterrissage
    if (p.vy > 0 && p.rush <= 0) {
      for (const pl of this.plats) {
        if (pl.kind === 'crumble' && pl.st === 2) continue;
        const inset = pl.kind === 'pumpkin' ? 7 : 0;
        if (prevY <= pl.y + 2 && p.y >= pl.y && p.x >= pl.x + inset - 3 && p.x <= pl.x + pl.w - inset + 3) {
          p.y = pl.y;
          p.squash = 0.12;
          if (pl.kind === 'pumpkin') {
            p.vy = -BOUNCE;
            pl.sq = 0.28;
            this.sfx('bounce');
            this.burst(p.x, p.y, 10, ['#ff8a1f', '#ffb04a', '#ffe14d'], 70, 0.5, 200);
          } else {
            p.vy = -JUMP;
            this.sfx('jump');
            this.burst(p.x, p.y, 4, ['#d9c6ff', '#8f6ad8'], 30, 0.3, 120);
            if (pl.kind === 'crumble' && pl.st === 0) {
              pl.st = 1;
              pl.t = 0.22;
            }
          }
          break;
        }
      }
    }

    // bonbons
    const cy = p.y - 8;
    for (let i = this.candies.length - 1; i >= 0; i--) {
      const c = this.candies[i];
      if (Math.abs(c.x - p.x) < 11 && Math.abs(c.y - cy) < 12) {
        this.candies.splice(i, 1);
        this.chain++;
        this.chainT = 2;
        const mult = Math.min(5, 1 + Math.floor((this.chain - 1) / 3));
        this.bonus += 10 * mult;
        this.candyCount++;
        this.sfx('candy', this.chain - 1);
        this.pops.push({ x: c.x, y: c.y - 6, text: `+${10 * mult}`, life: 0.8, col: mult > 1 ? '#ffe14d' : '#ffffff' });
        this.burst(c.x, c.y, 7, ['#ffffff', '#ffe14d', '#ff4fa3', '#3fd0ff'], 60, 0.45, 0);
      }
    }

    // bonus
    for (let i = this.powers.length - 1; i >= 0; i--) {
      const pw = this.powers[i];
      if (Math.abs(pw.x - p.x) < 12 && Math.abs(pw.y - cy) < 14) {
        this.powers.splice(i, 1);
        this.sfx(pw.kind === 'rush' ? 'rush' : 'power');
        if (pw.kind === 'shield') {
          p.shield = true;
          this.pops.push({ x: pw.x, y: pw.y - 8, text: 'BOUCLIER', life: 1.1, col: '#7ff0ff' });
          this.burst(pw.x, pw.y, 14, ['#7ff0ff', '#ffffff'], 80, 0.6, 0);
        } else {
          p.rush = RUSH_TIME;
          p.inv = RUSH_TIME;
          this.pops.push({ x: pw.x, y: pw.y - 8, text: 'SUPER SUCRE!', life: 1.2, col: '#ffe14d' });
          this.flashFx('#ffe14d', 0.5);
        }
      }
    }

    // ennemis : collisions
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const hw = e.kind === 'bat' ? 9 : 6;
      const hh = e.kind === 'bat' ? 5 : 7;
      if (Math.abs(e.x - p.x) < hw + 4 && Math.abs(e.y - cy) < hh + 6) {
        if (p.rush > 0) {
          this.killEnemy(i, 50, true);
        } else if (e.kind === 'bat' && p.vy > 40 && p.y - 4 < e.y) {
          p.vy = -420;
          p.squash = 0.12;
          this.stomps++;
          this.killEnemy(i, 50, true);
          this.sfx('stomp');
          this.shake = Math.max(this.shake, 2);
        } else if (p.inv <= 0) {
          if (p.shield) {
            p.shield = false;
            p.inv = 1.2;
            this.killEnemy(i, 0, false);
            this.sfx('shield');
            this.shake = 4;
            this.flashFx('#7ff0ff', 0.4);
          } else {
            this.die(false);
            break;
          }
        }
      }
    }

    // chute
    if (p.y > H + 20) {
      this.die(true);
    }

    // caméra
    const limit = H * 0.42;
    if (p.alive && p.y < limit) {
      const diff = limit - p.y;
      p.y = limit;
      this.scrollWorld(diff);
    }

    // IA : si mort en démo -> reset immédiat via finish()
    this.cleanup();
  }

  private killEnemy(i: number, pts: number, fx: boolean) {
    const e = this.enemies[i];
    this.enemies.splice(i, 1);
    if (pts) {
      this.bonus += pts;
      this.pops.push({ x: e.x, y: e.y - 6, text: `+${pts}`, life: 0.8, col: '#ff8fb0' });
    }
    this.burst(e.x, e.y, fx ? 14 : 10, e.kind === 'bat' ? ['#6a3ca8', '#ff3b3b', '#ffffff'] : ['#eaf6ff', '#a9d4f5', '#ffffff'], 80, 0.6, 100);
  }

  private die(fell: boolean) {
    const p = this.p;
    if (!p.alive) return;
    p.alive = false;
    p.deadT = 0;
    p.rush = 0;
    if (fell) {
      p.vy = 0;
      this.sfx('fall');
    } else {
      p.vy = -260;
      this.sfx('hurt');
      this.shake = 6;
      this.flashFx('#ff2d55', 0.5);
      this.burst(p.x, p.y - 8, 16, ['#ffffff', '#ff2d55', '#ffe14d'], 90, 0.7, 100);
    }
    audio.stopMusic();
  }

  private finish() {
    if (this.demo) {
      this.reset(true);
      return;
    }
    this.state = 'over';
    audio.stopMusic();
    audio.sfx('over');
    this.clearHeld();
    this.cb.onOver({
      score: this.score(),
      candies: this.candyCount,
      height: Math.floor(this.scroll / 8),
      stomps: this.stomps,
    });
    this.cb.onState('over');
  }

  private score() {
    return Math.floor(this.scroll / 8) + this.bonus;
  }

  private scrollWorld(d: number) {
    this.scroll += d;
    this.topY += d;
    for (const a of this.plats) a.y += d;
    for (const a of this.candies) a.y += d;
    for (const a of this.powers) a.y += d;
    for (const a of this.enemies) {
      a.y += d;
      a.base += d;
    }
    for (const a of this.parts) a.y += d;
    for (const a of this.pops) a.y += d;
    this.fill();
  }

  private cleanup() {
    const lim = H + 50;
    this.plats = this.plats.filter((a) => a.y < lim);
    this.candies = this.candies.filter((a) => a.y < lim);
    this.powers = this.powers.filter((a) => a.y < lim);
    this.enemies = this.enemies.filter((a) => a.y < lim);
  }

  /* ---------- Effets ---------- */
  private burst(x: number, y: number, n: number, cols: string[], speed: number, life: number, grav: number, size = 2, down = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.3, 1) * speed;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + down,
        life: life * rand(0.6, 1),
        max: life,
        col: cols[Math.floor(Math.random() * cols.length)],
        size,
        g: grav,
      });
    }
  }

  private flashFx(col: string, a: number) {
    this.flash = a;
    this.flashCol = col;
  }

  private updateFx(dt: number) {
    for (const q of this.parts) {
      q.life -= dt;
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    for (const q of this.pops) {
      q.life -= dt;
      q.y -= 14 * dt;
    }
    this.pops = this.pops.filter((q) => q.life > 0);
    this.shake = Math.max(0, this.shake - dt * 14);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  private emitHud() {
    const p = this.p;
    const mult = this.chain > 0 ? Math.min(5, 1 + Math.floor((this.chain - 1) / 3)) : 1;
    const h: Hud = {
      score: this.score(),
      height: Math.floor(this.scroll / 8),
      candies: this.candyCount,
      mult,
      chainFrac: this.chain > 0 ? Math.round(clamp(this.chainT / 2, 0, 1) * 10) / 10 : 0,
      shield: p.shield,
      rush: Math.round(clamp(p.rush / RUSH_TIME, 0, 1) * 20) / 20,
    };
    const key = `${h.score}|${h.candies}|${h.mult}|${h.chainFrac}|${h.shield}|${h.rush}`;
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.cb.onHud(h);
    }
  }

  /* ---------- Rendu ---------- */
  private render() {
    const g = this.ctx;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    if (this.shake > 0) g.translate(Math.round(rand(-1, 1) * this.shake), Math.round(rand(-1, 1) * this.shake));

    this.drawBackground(g);
    this.drawPlatforms(g);
    this.drawItems(g);
    this.drawEnemies(g);
    this.drawPlayer(g);
    this.drawParts(g);
    this.drawPops(g);
    g.restore();

    if (this.flash > 0) {
      g.globalAlpha = this.flash * 0.6;
      g.fillStyle = this.flashCol;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }

  private drawBackground(g: CanvasRenderingContext2D) {
    const a = Math.min(1, this.scroll / 4500);
    const topC = mix('#2a0f55', '#07021a', a);
    const botC = mix('#d1486a', '#35126e', a);
    const n = 20;
    const bh = Math.ceil(H / n);
    for (let i = 0; i < n; i++) {
      g.fillStyle = mix(rgbToHex(topC), rgbToHex(botC), Math.pow(i / (n - 1), 1.4));
      g.fillRect(0, i * bh, W, bh + 1);
    }

    // étoiles
    for (const s of this.stars) {
      const y = (((s.y + this.scroll * s.f) % H) + H) % H;
      const tw = 0.5 + 0.5 * Math.sin(this.time * 3 + s.tw);
      g.globalAlpha = (0.25 + 0.75 * a) * (0.4 + 0.6 * tw);
      g.fillStyle = '#fff6d0';
      g.fillRect(Math.floor(s.x), Math.floor(y), s.f > 0.05 ? 2 : 1, s.f > 0.05 ? 2 : 1);
    }
    g.globalAlpha = 1;

    // lune + halo
    const my = 52 + this.scroll * 0.03;
    if (my < H + 60) {
      for (let i = 3; i >= 1; i--) {
        g.globalAlpha = 0.06 * (4 - i);
        g.fillStyle = '#fff3c4';
        g.beginPath();
        g.arc(142, my + 23, 23 + i * 8, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.drawImage(this.spr.moon, 120, Math.round(my));
    }

    // nuages
    g.fillStyle = '#3a1a6a';
    g.globalAlpha = 0.55;
    for (const c of this.clouds) {
      const x = (((c.x + this.time * c.v) % (W + 100)) + W + 100) % (W + 100) - 50;
      const y = (((c.y + this.scroll * c.f) % (H + 40)) + H + 40) % (H + 40) - 20;
      g.fillRect(Math.round(x), Math.round(y), Math.round(c.w), 5);
      g.fillRect(Math.round(x + c.w * 0.2), Math.round(y - 4), Math.round(c.w * 0.5), 4);
      g.fillRect(Math.round(x + c.w * 0.35), Math.round(y - 7), Math.round(c.w * 0.2), 3);
    }
    g.globalAlpha = 1;

    // sol de départ
    const gy = H - 18 + this.scroll;
    if (gy < H + 70) {
      g.drawImage(this.spr.house, 58, Math.round(gy - 60));
      g.drawImage(this.spr.tree, 4, Math.round(gy - 56));
      g.fillStyle = '#0f0722';
      for (let x = 0; x < W; x += 2) {
        const hy = gy + 6 - Math.floor(4 + 4 * Math.sin(x * 0.05));
        g.fillRect(x, Math.round(hy), 2, H + 60);
      }
      g.fillStyle = '#1d0f3a';
      for (const tx of [150, 170, 112]) {
        g.fillRect(tx, Math.round(gy - 6), 7, 9);
        g.fillRect(tx + 1, Math.round(gy - 8), 5, 2);
      }
      g.fillStyle = '#ff8a1f';
      g.fillRect(136, Math.round(gy - 1), 6, 5);
      g.fillStyle = '#3f7d22';
      g.fillRect(138, Math.round(gy - 3), 2, 2);
    }
  }

  private drawPlatforms(g: CanvasRenderingContext2D) {
    for (const pl of this.plats) {
      let off = 0;
      if (pl.kind === 'crumble' && pl.st === 1) off = Math.round(Math.sin(this.time * 80) * 1);
      const x = Math.round(pl.x + off);
      const y = Math.round(pl.y);
      if (pl.kind === 'pumpkin') {
        const sprH = this.spr.pumpkin.height;
        const hh = pl.sq > 0 ? Math.round(sprH * clamp(0.75 + 0.25 * (1 - pl.sq / 0.28), 0.75, 1)) : sprH;
        g.drawImage(this.spr.pumpkin, x, y - 4 + (sprH - hh), pl.w, hh);
        // lueur
        g.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 6);
        g.fillStyle = '#ffe14d';
        g.fillRect(x + 12, y + 7, 3, 3);
        g.fillRect(x + 26, y + 7, 3, 3);
        g.globalAlpha = 1;
      } else {
        const s: Spr =
          pl.kind === 'crumble'
            ? this.spr.plat('crumble', pl.w)
            : pl.kind === 'move'
              ? this.spr.plat('move', pl.w)
              : this.spr.plat(pl.skin, pl.w);
        g.drawImage(s, x, y);
        if (pl.kind === 'move') {
          g.globalAlpha = 0.35 + 0.25 * Math.sin(this.time * 8);
          g.fillStyle = '#ffe14d';
          g.fillRect(x + 1, y + 2, 4, 4);
          g.fillRect(x + pl.w - 5, y + 2, 4, 4);
          g.globalAlpha = 1;
        }
      }
    }
  }

  private drawItems(g: CanvasRenderingContext2D) {
    for (const c of this.candies) {
      const bob = Math.round(Math.sin(c.t * 4) * 2);
      let s: Spr;
      if (c.type === 3) s = this.spr.lolli;
      else if (c.type === 2) s = this.spr.corn;
      else s = this.spr.wraps[c.type % 3];
      g.drawImage(s, Math.round(c.x - s.width / 2), Math.round(c.y - s.height / 2 + bob));
      if (Math.floor(c.t * 3) % 6 === 0) {
        g.fillStyle = '#fff';
        g.fillRect(Math.round(c.x + s.width / 2 - 1), Math.round(c.y - s.height / 2 + bob), 1, 1);
      }
    }
    for (const pw of this.powers) {
      const bob = Math.round(Math.sin(pw.t * 4) * 2);
      const s = pw.kind === 'shield' ? this.spr.potion : this.spr.star;
      g.globalAlpha = 0.25 + 0.15 * Math.sin(pw.t * 8);
      g.fillStyle = pw.kind === 'shield' ? '#7ff0ff' : '#ffe14d';
      g.beginPath();
      g.arc(pw.x, pw.y + bob, 11, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.drawImage(s, Math.round(pw.x - s.width / 2), Math.round(pw.y - s.height / 2 + bob));
    }
  }

  private drawEnemies(g: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      if (e.kind === 'bat') {
        const s = this.spr.bat[Math.floor(e.t * 9) % 2];
        g.drawImage(s, Math.round(e.x - 8), Math.round(e.y - 4));
      } else {
        const bob = Math.sin(e.t * 3) * 2;
        g.globalAlpha = 0.75 + 0.2 * Math.sin(e.t * 5);
        g.save();
        g.translate(Math.round(e.x), Math.round(e.y + bob));
        if (e.vx < 0) g.scale(-1, 1);
        g.drawImage(this.spr.ghost, -7, -7);
        g.restore();
        g.globalAlpha = 1;
      }
    }
  }

  private drawPlayer(g: CanvasRenderingContext2D) {
    const p = this.p;
    const frame = p.vy < -80 || p.rush > 0 ? this.spr.kid.up : this.spr.kid.down;
    const s = frame[p.face > 0 ? 0 : 1];
    if (p.inv > 0 && p.alive && p.rush <= 0 && Math.floor(this.time * 20) % 2 === 0) return;
    let sx = 1;
    let sy = 1;
    if (p.squash > 0) {
      sx = 1.25;
      sy = 0.8;
    } else if (p.vy < -280) {
      sx = 0.88;
      sy = 1.12;
    }
    g.save();
    g.translate(Math.round(p.x), Math.round(p.y));
    if (!p.alive) {
      g.translate(0, -8);
      g.rotate(p.rot);
      g.translate(0, 8);
    }
    g.scale(sx, sy);
    g.drawImage(s, -6, -16);
    g.restore();

    if (p.rush > 0) {
      g.save();
      g.translate(Math.round(p.x), Math.round(p.y - 8));
      g.rotate(this.time * 8);
      g.fillStyle = '#ffe14d';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.fillRect(Math.round(Math.cos(a) * 15) - 1, Math.round(Math.sin(a) * 15) - 1, 3, 3);
      }
      g.restore();
    }
    if (p.shield && p.alive) {
      const cx = Math.round(p.x);
      const cy = Math.round(p.y - 8);
      g.globalAlpha = 0.18 + 0.07 * Math.sin(this.time * 8);
      g.fillStyle = '#7ff0ff';
      g.beginPath();
      g.arc(cx, cy, 13, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.9;
      g.strokeStyle = '#bff8ff';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, 13, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#fff';
      g.fillRect(cx - 8, cy - 8, 2, 2);
    }
  }

  private drawParts(g: CanvasRenderingContext2D) {
    for (const q of this.parts) {
      g.globalAlpha = clamp(q.life / q.max, 0, 1);
      g.fillStyle = q.col;
      g.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
    }
    g.globalAlpha = 1;
  }

  private drawPops(g: CanvasRenderingContext2D) {
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const q of this.pops) {
      g.globalAlpha = clamp(q.life * 2, 0, 1);
      const x = Math.round(clamp(q.x, 30, W - 30));
      const y = Math.round(q.y);
      g.fillStyle = '#1b0f2b';
      g.fillText(q.text, x + 1, y + 1);
      g.fillStyle = q.col;
      g.fillText(q.text, x, y);
    }
    g.globalAlpha = 1;
  }
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return '#000000';
  return '#' + m.slice(0, 3).map((v) => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
}
