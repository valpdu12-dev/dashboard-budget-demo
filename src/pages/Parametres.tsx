// ── Écran Paramètres — LECTURE SEULE (D9) ────────────────────────────────
//
// Lot C.2. Cet écran montre ce que l'outil a lu, tel qu'il l'a lu. Rien ne
// s'y modifie : l'écran modifiable est reporté à un lot ultérieur, avec la
// question qu'il ouvre — qui gagne, du fichier ou de l'écran.
//
// LA RÈGLE DE CET ÉCRAN : ce qui manque y figure COMME MANQUANT, jamais comme
// vide. Un tiret muet dans une colonne « Taux » laisserait croire à un taux
// nul ; « 100 % (par défaut) » dit ce que l'outil applique et d'où ça vient.
//
// Contrat : `docs/CONTRAT_PARAMETRAGE.md`, §D9.

import { FileWarning, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDataStore } from "@/stores/useDataStore";
import { fmt } from "@/utils/formatters";
import type { BudgetConfig } from "@/types/budgetConfig";

/** Ce qu'on affiche quand la source n'a rien déclaré. */
const ABSENT = "non déclaré";

function Section({
  titre,
  soustitre,
  children,
}: {
  titre: string;
  soustitre?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-title font-bold text-text mb-1">{titre}</h2>
      {soustitre && <p className="text-xs text-text-sec mb-2">{soustitre}</p>}
      <div className="border border-border rounded-lg overflow-x-auto">{children}</div>
    </section>
  );
}

/**
 * L'absence, écrite en toutes lettres.
 *
 * La phrase entière est passée en paramètre, pas le nom de la chose : « Aucun
 * catégorie déclaré » est le genre de détail qui fait douter de tout le reste.
 */
function Rien({ texte }: { texte: string }) {
  return <p className="px-3 py-3 text-xs text-text-sec">{texte}</p>;
}

const TH = "px-3 py-2 text-left font-medium text-text-sec whitespace-nowrap";
const TD = "px-3 py-2 text-text whitespace-nowrap";
const TD_ABSENT = "px-3 py-2 text-text-sec/70 italic whitespace-nowrap";

/**
 * Un taux en pourcentage lisible.
 *
 * ⚠️ L'arrondi est indispensable : `0.3 * 100` vaut 30.000000000000004 en
 * virgule flottante, et « 30,00 % » affiché à partir de là passerait encore,
 * mais « 33,33 % » deviendrait « 33,329999999999998 % ».
 */
function pourcent(taux: number): string {
  const p = Math.round(taux * 10000) / 100;
  return `${p % 1 === 0 ? p.toFixed(0) : String(p).replace(".", ",")} %`;
}

/** Une cellule qui dit « non déclaré » plutôt que de rester vide. */
function Cellule({ valeur }: { valeur: string | null }) {
  return valeur === null ? (
    <td className={TD_ABSENT}>{ABSENT}</td>
  ) : (
    <td className={TD}>{valeur}</td>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function TableauComptes({ config }: { config: BudgetConfig }) {
  if (config.comptes.length === 0) {
    return <Rien texte="Aucun compte déclaré dans le fichier source." />;
  }

  const parId = new Map(config.comptes.map((c) => [c.id, c.libelle]));

  return (
    <table className="w-full text-xs">
      <thead className="bg-border/20 border-b border-border">
        <tr>
          <th className={TH}>Compte</th>
          <th className={TH}>Organisme</th>
          <th className={TH}>Participation</th>
          <th className={TH}>Compte lié</th>
          <th className={TH}>Sens répercuté</th>
          <th className={TH}>Porte un solde</th>
          <th className={TH}>Solde de départ</th>
          <th className={TH}>Couleur</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {config.comptes.map((c) => (
          <tr key={c.id}>
            <td className={TD}>{c.libelle}</td>
            <Cellule valeur={c.organisme} />
            <td className={TD}>
              {pourcent(c.participation)}
              {c.participation === 1 && (
                <span className="text-text-sec/70"> (par défaut)</span>
              )}
            </td>
            <Cellule valeur={c.compteLie === null ? null : parId.get(c.compteLie) ?? c.compteLie} />
            <Cellule valeur={c.sensRepercute} />
            <td className={TD}>{c.porteUnSolde ? "oui" : "non"}</td>
            {c.soldeDepart === null ? (
              <td className={TD_ABSENT}>non initialisé</td>
            ) : (
              <td className={TD}>{fmt(c.soldeDepart)}</td>
            )}
            <td className={TD}>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: c.couleur }}
                />
                {c.couleur}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableauTypes({ config }: { config: BudgetConfig }) {
  if (config.types.length === 0) {
    return <Rien texte="Aucun type déclaré dans le fichier source." />;
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-border/20 border-b border-border">
        <tr>
          <th className={TH}>Type</th>
          <th className={TH}>Nature</th>
          <th className={TH}>Classe par défaut</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {config.types.map((t) => (
          <tr key={t.cle}>
            <td className={TD}>{t.libelle}</td>
            {t.natures.length === 0 ? (
              <td className={TD_ABSENT}>mouvement ordinaire</td>
            ) : (
              <td className={TD}>{t.natures.join(", ")}</td>
            )}
            <Cellule valeur={t.classeParDefaut} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListeSimple({ valeurs, vide }: { valeurs: string[]; vide: string }) {
  if (valeurs.length === 0) return <Rien texte={vide} />;
  return (
    <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
      {valeurs.map((v) => (
        <span
          key={v}
          className="px-2 py-0.5 rounded-xl bg-border/30 border border-border text-[11px] text-text"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

export default function Parametres() {
  const config = useDataStore((s) => s.config);
  const origin = useDataStore((s) => s.origin);
  const parametrage = config?.parametrage;

  if (!parametrage) {
    return (
      <div>
        <PageHeader
          title="Paramètres"
          subtitle="Ce que l'outil a lu dans votre fichier source"
        />
        <EmptyState
          icon={<FileWarning size={36} />}
          title="Aucune configuration lue"
          description={
            origin === "static"
              ? "Le jeu de démonstration ne déclare pas de configuration : ses comptes et ses types sont ceux écrits dans l'application. Importez votre classeur pour voir la vôtre."
              : "Votre fichier ne porte pas de feuille « Paramètres », ou elle ne déclare ni compte, ni type, ni catégorie. Les soldes restent « non initialisés » — jamais 0."
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Ce que l'outil a lu dans votre fichier source — lecture seule"
      />

      <p className="text-[12px] text-text-sec mb-5 px-3 py-2 bg-border/20 border border-border rounded-lg leading-relaxed flex gap-2">
        <SlidersHorizontal size={14} className="shrink-0 mt-0.5" />
        <span>
          Cet écran ne se modifie pas. Pour changer une valeur, corrigez votre
          classeur et réimportez-le : c'est le fichier qui fait foi.
        </span>
      </p>

      <Section
        titre="Comptes"
        soustitre="Un taux de participation absent vaut 100 %. Un solde absent est « non initialisé », jamais 0."
      >
        <TableauComptes config={parametrage} />
      </Section>

      <Section
        titre="Types"
        soustitre="La nature dit ce que le mouvement fait aux calculs. Un type sans nature est un mouvement ordinaire."
      >
        <TableauTypes config={parametrage} />
      </Section>

      <Section titre="Sorties d'épargne">
        {parametrage.compteCreditSortiesEpargne === null ? (
          <p className="px-3 py-3 text-xs text-text-sec">
            Aucun compte déclaré pour recevoir les sorties d'épargne. Elles ne
            sont reprises dans aucun solde.
          </p>
        ) : (
          <p className="px-3 py-3 text-xs text-text">
            Créditées sur{" "}
            <span className="font-medium">
              {parametrage.comptes.find(
                (c) => c.id === parametrage.compteCreditSortiesEpargne
              )?.libelle ?? parametrage.compteCreditSortiesEpargne}
            </span>
            .
          </p>
        )}
      </Section>

      <Section titre="Catégories">
        <ListeSimple
          valeurs={parametrage.categories.map((c) => c.libelle)}
          vide="Aucune catégorie déclarée dans le fichier source."
        />
      </Section>

      <Section titre="Employeurs">
        <ListeSimple
          valeurs={parametrage.employeurs}
          vide="Aucun employeur déclaré dans le fichier source."
        />
      </Section>
    </div>
  );
}
