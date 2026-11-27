import React from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm select-none">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-orange-500/40 bg-slate-900 shadow-2xl shadow-orange-500/10">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 p-4 sm:p-5 text-white">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl">ℹ️</span>
            <h2 className="text-lg sm:text-xl font-bold tracking-wide">Comment Chasse aux Bonbons a été fait</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-3.5 text-slate-300 text-xs sm:text-sm leading-relaxed">
          <p>
            <strong className="text-orange-400">Stack :</strong> React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7, build single-file HTML autonome (&lt; 260 Ko), zéro dépendance externe au runtime.
          </p>
          <p>
            <strong className="text-orange-400">Graphismes :</strong> Moteur de rendu Canvas 2D avec sprites pixel art dessinés programmatiquement (citrouille, chauve-souris, fantômes, friandises, corniches gothiques), ciel étoilé et particules.
          </p>
          <p>
            <strong className="text-orange-400">Musique &amp; sons :</strong> Synthèse Web Audio API temps réel (arpeggios chiptune rétro, bruitages dynamiques de saut, de collecte de friandise et de défaite).
          </p>
          <p>
            <strong className="text-orange-400">Interactions :</strong> Clavier (Flèches gauche/droite ou Q/D pour courir, Espace ou Flèche haut pour sauter), tactile plein écran avec zones virtuelles pour smartphone.
          </p>
          <p>
            <strong className="text-orange-400">Architecture :</strong> Boucle requestAnimationFrame avec delta-time fixe, état de jeu réactif (score, vies, hauteur atteinte) et persistance du meilleur score en localStorage.
          </p>
          <p>
            <strong className="text-orange-400">Algorithmes notables :</strong> Génération procédurale verticale infinie de plateformes avec espacements garantis franchissables, physique de saut parabolique et détection de collision boîte englobante AABB.
          </p>
        </div>

        <p className="px-4 pb-1 text-center text-[11px] text-slate-400">Créé par Geoffroy Streit (Hylst) avec l'aide d'une IA.</p>
        <div className="bg-slate-950 p-3 sm:p-4 text-center border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl font-bold text-white bg-orange-600 hover:bg-orange-500 transition cursor-pointer text-sm shadow-md"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
