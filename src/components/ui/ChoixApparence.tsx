// ── Les trois pilules Auto · Jour · Nuit ────────────────────────────────────
// Fond = surface, bord fin ; le choix actif est plein (couleur du texte, écrit
// avec la couleur du fond). Boutons radio (role="radio") : un seul arrêt de Tab
// (le choix actif), les flèches et Début / Fin changent de choix.
// `grand` : cibles de 44 px (panneau Filtres du téléphone).
// `nommePar` : id d'un titre visible qui nomme le groupe (sinon « Apparence »).
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { choisirTheme, EVENEMENT_APPARENCE, lireChoixTheme, type ChoixTheme } from "@/theme";

const CHOIX: { valeur: ChoixTheme; nom: string }[] = [
  { valeur: "auto", nom: "Auto" },
  { valeur: "jour", nom: "Jour" },
  { valeur: "nuit", nom: "Nuit" },
];

export function ChoixApparence({ grand = false, nommePar }: { grand?: boolean; nommePar?: string }) {
  const [choix, setChoix] = useState<ChoixTheme>(lireChoixTheme);
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const suivre = (e: Event) => setChoix((e as CustomEvent<ChoixTheme>).detail);
    window.addEventListener(EVENEMENT_APPARENCE, suivre);
    return () => window.removeEventListener(EVENEMENT_APPARENCE, suivre);
  }, []);

  const auClavier = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = CHOIX.findIndex((c) => c.valeur === choix);
    const cible =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % CHOIX.length
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i + CHOIX.length - 1) % CHOIX.length
      : e.key === "Home" ? 0
      : e.key === "End" ? CHOIX.length - 1
      : -1;
    if (cible < 0) return;
    e.preventDefault();
    choisirTheme(CHOIX[cible].valeur);
    boutons.current[cible]?.focus();
  };

  return (
    <div
      role="radiogroup"
      {...(nommePar ? { "aria-labelledby": nommePar } : { "aria-label": "Apparence" })}
      onKeyDown={auClavier}
      className="inline-flex flex-wrap gap-0.5 p-[3px] rounded-full bg-surface shadow-[inset_0_0_0_1px_rgb(var(--c-border))]"
    >
      {CHOIX.map((c, i) => (
        <button
          key={c.valeur}
          ref={(n) => { boutons.current[i] = n; }}
          type="button"
          role="radio"
          aria-checked={choix === c.valeur}
          tabIndex={choix === c.valeur ? 0 : -1}
          onClick={() => choisirTheme(c.valeur)}
          className={`rounded-full border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
            grand ? "min-h-[44px] px-[18px] text-sm" : "min-h-[34px] px-3.5 text-[13px]"
          } ${choix === c.valeur ? "bg-text text-bg font-semibold" : "bg-transparent text-text-sec hover:text-text font-medium"}`}
        >
          {c.nom}
        </button>
      ))}
    </div>
  );
}
