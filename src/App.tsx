import { InfoModal } from './components/InfoModal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game, type GameState, type Hud, type OverInfo } from './game/engine';
import { audio } from './game/audio';

const SCORES_KEY = 'chasse-bonbons-scores-v1';

function loadScores(): number[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number').slice(0, 5) : [];
  } catch {
    return [];
  }
}

const EMPTY_HUD: Hud = { score: 0, height: 0, candies: 0, mult: 1, chainFrac: 0, shield: false, rush: 0 };

const LEGEND: { icon: string; title: string; text: string }[] = [
  { icon: '🍬', title: 'Bonbons', text: '+10 pts. Enchaîne-les pour un combo jusqu\'à x5 !' },
  { icon: '🎃', title: 'Citrouille', text: 'Super rebond vers le ciel.' },
  { icon: '🦇', title: 'Chauve-souris', text: 'Saute dessus pour l\'écraser (+50).' },
  { icon: '👻', title: 'Fantôme', text: 'Il te traque. Ne le touche pas !' },
  { icon: '🧪', title: 'Potion', text: 'Un bouclier qui absorbe 1 coup.' },
  { icon: '⭐', title: 'Super Sucre', text: 'Fusée invincible pendant 1,9 s.' },
  { icon: '🪵', title: 'Branche sèche', text: 'Elle casse juste après ton saut.' },
];

const DRIFTERS = ['🎃', '🦇', '👻', '🍬', '🦇', '🕷️', '🍭', '🎃'];

export default function App() {
  const [showInfo, setShowInfo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const stateRef = useRef<GameState>('menu');

  const [gstate, setGstate] = useState<GameState>('menu');
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [scores, setScores] = useState<number[]>(() => loadScores());
  const [over, setOver] = useState<(OverInfo & { record: boolean }) | null>(null);
  const [muted, setMuted] = useState(false);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

  const best = scores[0] ?? 0;

  /* ---------- Création du jeu ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, {
      onHud: setHud,
      onState: (s) => {
        stateRef.current = s;
        setGstate(s);
      },
      onOver: (info) => {
        const prevBest = scoresRef.current[0] ?? 0;
        const next = [...scoresRef.current, info.score]
          .filter((n) => n > 0)
          .sort((a, b) => b - a)
          .slice(0, 5);
        try {
          localStorage.setItem(SCORES_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        setScores(next);
        setOver({ ...info, record: info.score > 0 && info.score > prevBest });
      },
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const startGame = useCallback(() => {
    setOver(null);
    setHud(EMPTY_HUD);
    gameRef.current?.start();
  }, []);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    if (stateRef.current === 'playing') g.pause();
    else if (stateRef.current === 'paused') g.resume();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audio.setMuted(!m);
      return !m;
    });
  }, []);

  /* ---------- Clavier ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
      if (k === 'arrowleft' || k === 'a' || k === 'q') g.setHeld('kl', true);
      else if (k === 'arrowright' || k === 'd') g.setHeld('kr', true);
      else if (k === ' ' || k === 'enter') {
        if (e.repeat) return;
        const s = stateRef.current;
        if (s === 'menu' || s === 'over') {
          e.preventDefault();
          startGame();
        } else if (s === 'paused') g.resume();
      } else if (k === 'p' || k === 'escape') {
        if (!e.repeat) togglePause();
      } else if (k === 'm') {
        if (!e.repeat) toggleMute();
      }
    };
    const up = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a' || k === 'q') g.setHeld('kl', false);
      else if (k === 'arrowright' || k === 'd') g.setHeld('kr', false);
    };
    const hide = () => {
      if (document.hidden) gameRef.current?.pause();
    };
    const blur = () => {
      gameRef.current?.clearHeld();
      gameRef.current?.pause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [startGame, togglePause, toggleMute]);

  /* ---------- Tactile sur l'écran ---------- */
  const touchSide = useRef<'tl' | 'tr' | null>(null);
  const setTouch = (side: 'tl' | 'tr' | null) => {
    const g = gameRef.current;
    if (!g || touchSide.current === side) return;
    if (touchSide.current) g.setHeld(touchSide.current, false);
    touchSide.current = side;
    if (side) g.setHeld(side, true);
  };
  const sideFor = (e: React.PointerEvent<HTMLDivElement>): 'tl' | 'tr' => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX - r.left < r.width / 2 ? 'tl' : 'tr';
  };

  /* ---------- Boutons de la borne ---------- */
  const holdProps = (name: 'bl' | 'br') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      gameRef.current?.setHeld(name, true);
    },
    onPointerUp: () => gameRef.current?.setHeld(name, false),
    onPointerCancel: () => gameRef.current?.setHeld(name, false),
    onLostPointerCapture: () => gameRef.current?.setHeld(name, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const drifters = useMemo(
    () =>
      DRIFTERS.map((emoji, i) => ({
        emoji,
        left: 6 + ((i * 37) % 90),
        dur: 18 + ((i * 7) % 14),
        delay: -((i * 5) % 20),
        size: 18 + ((i * 5) % 16),
      })),
    [],
  );

  const liveBest = Math.max(best, hud.score);
  const playingUI = gstate === 'playing' || gstate === 'paused';

  return (
    <div className="font-pixel relative flex min-h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a0f55_0%,#0a0516_65%)] p-2 text-white">
      {/* Décor flottant */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20" aria-hidden>
        {drifters.map((d, i) => (
          <span
            key={i}
            className="drift absolute top-0"
            style={{ left: `${d.left}%`, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s`, fontSize: d.size }}
          >
            {d.emoji}
          </span>
        ))}
      </div>

      <div className="relative z-10 flex w-full items-center justify-center gap-6 xl:gap-10">
        {/* Légende */}
        <aside className="hidden w-56 shrink-0 rounded-xl border-2 border-[#5a2fb8] bg-[#140a2b]/85 p-4 lg:block xl:w-64">
          <h2 className="neon-purple mb-3 text-center text-[11px]">BESTIAIRE</h2>
          <ul className="space-y-3">
            {LEGEND.map((l) => (
              <li key={l.title} className="flex gap-3">
                <span className="text-xl leading-none">{l.icon}</span>
                <div>
                  <div className="text-[9px] text-[#ffb347]">{l.title}</div>
                  <div className="mt-1 text-[8px] leading-[1.6] text-[#c9b8f0]">{l.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Borne d'arcade */}
        <div
          className="@container flex flex-col"
          style={{ width: 'max(230px, min(94vw, calc((100dvh - 250px) * 0.6)))' }}
        >
          <div className="rounded-t-2xl border-4 border-b-0 border-[#5a2fb8] bg-gradient-to-b from-[#3b1580] to-[#220a4d] px-[3cqw] py-[2.4cqw] text-center">
            <div className="neon-orange flicker text-[4.6cqw] leading-tight">CHASSE AUX BONBONS</div>
            <div className="neon-purple mt-[1.2cqw] text-[2.6cqw] tracking-wider">★ INFINIE ★</div>
          </div>

          <div className="border-x-4 border-[#5a2fb8] bg-[#0d0620] p-[3cqw]">
            {/* ÉCRAN */}
            <div
              className="scanlines crt-vignette @container relative aspect-[192/320] w-full select-none overflow-hidden rounded-[2cqw] bg-black shadow-[0_0_0_2px_#000,0_0_30px_rgba(123,63,228,0.55)]"
              onPointerDown={(e) => {
                if (stateRef.current !== 'playing') return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setTouch(sideFor(e));
              }}
              onPointerMove={(e) => {
                if (stateRef.current !== 'playing' || !touchSide.current) return;
                setTouch(sideFor(e));
              }}
              onPointerUp={() => setTouch(null)}
              onPointerCancel={() => setTouch(null)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <canvas ref={canvasRef} className="pixel-canvas absolute inset-0 h-full w-full" />

              {/* HUD */}
              {playingUI && <HudView hud={hud} best={liveBest} />}

              {/* Menu */}
              {gstate === 'menu' && <MenuView best={best} onStart={startGame} />}

              {/* Pause */}
              {gstate === 'paused' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[5cqw] bg-[#0a0516]/75">
                  <div className="neon-purple pop-in text-[9cqw]">PAUSE</div>
                  <button
                    onClick={togglePause}
                    className="arcade-btn rounded-[1.5cqw] border-2 border-white/80 bg-[#ff8a1f] px-[5cqw] py-[3cqw] text-[3.6cqw] text-[#1b0f2b] shadow-[0_1.2cqw_0_#a8530a]"
                  >
                    ▶ REPRENDRE
                  </button>
                  <div className="text-center text-[2.4cqw] leading-[1.9] text-[#c9b8f0]">
                    P / ÉCHAP : reprendre
                    <br />M : son
                  </div>
                </div>
              )}

              {/* Game over */}
              {gstate === 'over' && over && (
                <OverView info={over} best={best} onRestart={startGame} onMenu={() => gameRef.current?.toMenu()} />
              )}
            </div>
          </div>

          {/* Panneau de contrôle */}
          <div className="flex items-center justify-between rounded-b-2xl border-4 border-t-0 border-[#5a2fb8] bg-gradient-to-b from-[#2a1060] to-[#170a35] px-[4cqw] py-[3.2cqw]">
            <div className="flex gap-[2.5cqw]">
              <button
                aria-label="Aller à gauche"
                {...holdProps('bl')}
                className="arcade-btn flex h-[15cqw] w-[15cqw] touch-none items-center justify-center rounded-[2cqw] border-2 border-[#d8b8ff] bg-[#7b3fe4] text-[6cqw] shadow-[0_1.2cqw_0_#3a1a85]"
              >
                ◀
              </button>
              <button
                aria-label="Aller à droite"
                {...holdProps('br')}
                className="arcade-btn flex h-[15cqw] w-[15cqw] touch-none items-center justify-center rounded-[2cqw] border-2 border-[#d8b8ff] bg-[#7b3fe4] text-[6cqw] shadow-[0_1.2cqw_0_#3a1a85]"
              >
                ▶
              </button>
            </div>

            <div className="flex flex-col gap-[2cqw]">
              <button
                onClick={togglePause}
                disabled={!playingUI}
                className="arcade-btn rounded-[1.2cqw] border-2 border-[#5a2fb8] bg-[#1b0f2b] px-[2.4cqw] py-[1.6cqw] text-[2.4cqw] text-[#d8b8ff] disabled:opacity-40"
              >
                {gstate === 'paused' ? 'REPRENDRE' : 'PAUSE'}
              </button>
              <button
                onClick={toggleMute}
                className="arcade-btn rounded-[1.2cqw] border-2 border-[#5a2fb8] bg-[#1b0f2b] px-[2.4cqw] py-[1.6cqw] text-[2.4cqw] text-[#d8b8ff]"
              >
                {muted ? '🔇 SON OFF' : '🔊 SON ON'}
              </button>
            </div>

            <button
              onClick={() => (gstate === 'playing' ? togglePause() : gstate === 'paused' ? togglePause() : startGame())}
              aria-label="Jouer"
              className="arcade-btn flex h-[16cqw] w-[16cqw] items-center justify-center rounded-full border-[0.8cqw] border-[#ffd9a8] bg-[#ff8a1f] text-[2.6cqw] leading-tight text-[#1b0f2b] shadow-[0_1.4cqw_0_#a8530a]"
            >
              {gstate === 'playing' ? 'II' : gstate === 'paused' ? '▶' : gstate === 'over' ? 'REJ.' : 'JOUER'}
            </button>
          </div>

          <p className="mt-3 text-center text-[2.3cqw] leading-[1.9] text-[#8f7bc2] lg:hidden">
            Touche la moitié gauche / droite de l&apos;écran pour bouger
          </p>
        </div>

        {/* Scores & commandes */}
        <aside className="hidden w-56 shrink-0 space-y-4 lg:block xl:w-64">
          <div className="rounded-xl border-2 border-[#5a2fb8] bg-[#140a2b]/85 p-4">
            <h2 className="neon-orange mb-3 text-center text-[11px]">TOP 5</h2>
            <ol className="space-y-2 text-[10px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex justify-between">
                  <span className={i === 0 ? 'text-[#ffe14d]' : 'text-[#c9b8f0]'}>
                    {i + 1}. {i === 0 ? '👑' : ''}
                  </span>
                  <span className={i === 0 ? 'text-[#ffe14d]' : 'text-white'}>
                    {scores[i] !== undefined ? scores[i].toString().padStart(6, '0') : '------'}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border-2 border-[#5a2fb8] bg-[#140a2b]/85 p-4">
            <h2 className="neon-purple mb-3 text-center text-[11px]">COMMANDES</h2>
            <ul className="space-y-2 text-[8px] leading-[1.7] text-[#c9b8f0]">
              <li>
                <span className="text-[#ffb347]">← → / Q D</span> bouger
              </li>
              <li>
                <span className="text-[#ffb347]">ESPACE</span> jouer
              </li>
              <li>
                <span className="text-[#ffb347]">P</span> pause
              </li>
              <li>
                <span className="text-[#ffb347]">M</span> couper le son
              </li>
              <li className="pt-1 text-[#8f7bc2]">L&apos;enfant rebondit tout seul. Sors d&apos;un côté, tu reviens de l&apos;autre !</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Bouton Infos technique */}
      <button
        onClick={() => setShowInfo(true)}
        className="fixed top-2.5 right-2.5 z-[100] flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-900/80 px-2 py-1 text-xs text-amber-200 shadow-md backdrop-blur hover:bg-slate-800 transition cursor-pointer select-none"
        title="Comment ce jeu a été fait"
        aria-label="Infos sur le jeu"
      >
        <span>ℹ️</span>
        <span className="hidden sm:inline">Infos</span>
      </button>
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}

/* ================= Sous-composants ================= */

function HudView({ hud, best }: { hud: Hud; best: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-[2.6cqw]">
      <div className="hud-text flex items-start justify-between">
        <div>
          <div className="text-[2.6cqw] text-[#ffb347]">SCORE</div>
          <div className="mt-[0.8cqw] text-[5cqw] text-white">{hud.score.toString().padStart(6, '0')}</div>
        </div>
        <div className="text-center">
          <div className="text-[2.6cqw] text-[#ff9fd0]">BONBONS</div>
          <div className="mt-[0.8cqw] text-[5cqw] text-white">🍬{hud.candies}</div>
        </div>
        <div className="text-right">
          <div className="text-[2.6cqw] text-[#7ff0ff]">RECORD</div>
          <div className="mt-[0.8cqw] text-[5cqw] text-[#ffe14d]">{best.toString().padStart(6, '0')}</div>
        </div>
      </div>

      <div className="hud-text mt-[2cqw] flex flex-col items-start gap-[1.6cqw]">
        {hud.mult > 1 && (
          <div className="pop-in">
            <div className="text-[3.6cqw] text-[#ffe14d]">COMBO x{hud.mult}</div>
            <div className="mt-[0.8cqw] h-[1.2cqw] w-[22cqw] bg-black/60">
              <div className="h-full bg-[#ffe14d]" style={{ width: `${hud.chainFrac * 100}%` }} />
            </div>
          </div>
        )}
        {hud.shield && <div className="text-[2.8cqw] text-[#7ff0ff]">🧪 BOUCLIER</div>}
        {hud.rush > 0 && (
          <div>
            <div className="text-[2.8cqw] text-[#ffe14d]">⭐ SUPER SUCRE</div>
            <div className="mt-[0.8cqw] h-[1.2cqw] w-[22cqw] bg-black/60">
              <div className="h-full bg-gradient-to-r from-[#ff4d00] to-[#ffe14d]" style={{ width: `${hud.rush * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuView({ best, onStart }: { best: number; onStart: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 flex cursor-pointer flex-col justify-between"
      onClick={onStart}
      role="button"
      aria-label="Commencer la partie"
    >
      <div className="bg-gradient-to-b from-[#0a0516]/90 via-[#0a0516]/70 to-transparent px-[4cqw] pb-[10cqw] pt-[6cqw] text-center">
        <div className="floaty text-[13cqw] leading-none">🎃</div>
        <div className="neon-orange mt-[3cqw] text-[6.6cqw] leading-[1.35]">
          LA CHASSE
          <br />
          AUX BONBONS
        </div>
        <div className="neon-purple mt-[2.4cqw] text-[3.4cqw]">★ INFINIE ★</div>
      </div>

      <div className="bg-gradient-to-t from-[#0a0516]/95 via-[#0a0516]/75 to-transparent px-[4cqw] pb-[6cqw] pt-[14cqw] text-center">
        <div className="blink neon-green text-[4.2cqw]">▶ APPUIE POUR JOUER ◀</div>
        <div className="mt-[3.4cqw] text-[2.6cqw] leading-[2] text-[#d8b8ff]">
          ← → ou Q D : bouger
          <br />
          Attrape les 🍬 · Écrase les 🦇 · Fuis les 👻
        </div>
        {best > 0 && <div className="mt-[3cqw] text-[3cqw] text-[#ffe14d]">RECORD {best.toString().padStart(6, '0')}</div>}
      </div>
    </div>
  );
}

function OverView({
  info,
  best,
  onRestart,
  onMenu,
}: {
  info: OverInfo & { record: boolean };
  best: number;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[4cqw] bg-[#0a0516]/80 px-[5cqw]">
      <div className="neon-red pop-in text-[8.5cqw] leading-[1.3] text-center">
        GAME
        <br />
        OVER
      </div>
      {info.record && <div className="blink neon-orange text-[3.4cqw]">★ NOUVEAU RECORD ★</div>}
      <div className="w-full space-y-[2.4cqw] rounded-[2cqw] border-2 border-[#5a2fb8] bg-[#140a2b]/90 p-[4cqw] text-[3.2cqw]">
        <Row label="SCORE" value={info.score.toString().padStart(6, '0')} color="#ffffff" />
        <Row label="ALTITUDE" value={`${info.height} m`} color="#7ff0ff" />
        <Row label="BONBONS" value={`🍬 ${info.candies}`} color="#ff9fd0" />
        <Row label="ÉCRASÉS" value={`🦇 ${info.stomps}`} color="#d8b8ff" />
        <Row label="RECORD" value={best.toString().padStart(6, '0')} color="#ffe14d" />
      </div>
      <button
        autoFocus
        onClick={onRestart}
        className="arcade-btn rounded-[1.5cqw] border-2 border-white/80 bg-[#ff8a1f] px-[6cqw] py-[3cqw] text-[3.8cqw] text-[#1b0f2b] shadow-[0_1.2cqw_0_#a8530a]"
      >
        ▶ REJOUER
      </button>
      <button onClick={onMenu} className="text-[2.6cqw] text-[#a58ad8] underline underline-offset-4">
        Retour à l&apos;accueil
      </button>
      <div className="text-[2.2cqw] text-[#8f7bc2]">ESPACE pour rejouer</div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#a58ad8]">{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}
