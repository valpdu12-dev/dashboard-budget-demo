// ── Politique de sécurité du contenu, et en-têtes de l'hébergeur ─────────
//
// Lot B.7. Le site reçoit désormais le CLASSEUR de la personne : ses comptes,
// ses salaires, ses dépenses. Tout se lit dans son navigateur, rien n'est
// envoyé — c'est écrit partout dans l'application. Une politique de sécurité
// du contenu est ce qui rend cette phrase VÉRIFIABLE plutôt que promise : le
// navigateur refuse lui-même toute requête sortante et tout script étranger,
// même si un jour une dépendance en introduisait un.
//
// La politique est écrite ICI, une seule fois. Vite l'injecte au build dans
// `index.html` (balise `<meta>`) et produit le fichier `_headers` que
// Cloudflare Pages sert en en-tête HTTP. Deux copies à la main auraient
// divergé au premier ajout.
//
// ⚠️ Rien de tout cela ne s'applique en développement (`npm run dev`) : le
// serveur de Vite injecte ses propres scripts en ligne, qu'une politique
// stricte casserait. Le contrôle se fait sur le build — `npm run preview`
// sert `dist/` avec la balise, c'est là qu'on le vérifie.

/**
 * Les directives, et pourquoi chacune est là.
 *
 * `'unsafe-inline'` sur les styles est le seul relâchement, et il est
 * mesuré : Recharts pose ses dimensions en attribut `style`, que la directive
 * couvre. Un style en ligne n'exécute pas de code — c'est sans commune mesure
 * avec `'unsafe-inline'` sur les scripts, qui n'est pas ici.
 *
 * Aucun `'unsafe-eval'` : vérifié sur le build, ni `eval(` ni `new Function`
 * dans les bundles, SheetJS compris.
 */
const DIRECTIVES: readonly [string, string][] = [
  // Tout ce qui n'est pas nommé plus bas : le site lui-même, et rien d'autre.
  ["default-src", "'self'"],
  // Aucun script en ligne, aucun script d'un autre domaine.
  ["script-src", "'self'"],
  // Le worker de lecture des classeurs est un fichier du site (Vite, format es).
  ["worker-src", "'self'"],
  // Voir le commentaire ci-dessus pour `'unsafe-inline'`.
  ["style-src", "'self' 'unsafe-inline'"],
  // `data:` couvre les petites images encodées dans le CSS. Le build n'en
  // porte aucune aujourd'hui ; une image ne s'exécute pas, l'autoriser ne
  // coûte rien et évite une casse silencieuse au premier pictogramme.
  ["img-src", "'self' data:"],
  // Polices embarquées, servies depuis /assets/.
  ["font-src", "'self'"],
  // LA directive qui compte pour la promesse « rien ne sort » : le classeur
  // importé ne peut être envoyé nulle part, le navigateur s'y oppose.
  ["connect-src", "'self'"],
  ["manifest-src", "'self'"],
  // Pas de formulaire, donc aucune destination d'envoi.
  ["form-action", "'none'"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ["frame-src", "'none'"],
];

/**
 * `frame-ancestors` interdit d'encadrer le site dans une page tierce.
 *
 * Elle est IGNORÉE dans une balise `<meta>` — le navigateur le dit dans la
 * console. Elle ne part donc que dans l'en-tête HTTP.
 */
const DIRECTIVE_CADRAGE: [string, string] = ["frame-ancestors", "'none'"];

function assembler(directives: readonly [string, string][]): string {
  return directives.map(([nom, valeur]) => `${nom} ${valeur}`).join("; ");
}

/** Politique posée dans `index.html` au build. Sans `frame-ancestors`. */
export const CSP_META = assembler(DIRECTIVES);

/** Politique servie en en-tête HTTP. Avec `frame-ancestors`. */
export const CSP_ENTETE = assembler([...DIRECTIVES, DIRECTIVE_CADRAGE]);

/**
 * Les en-têtes que l'hébergeur ajoute à chaque réponse.
 *
 * `X-Frame-Options` fait doublon avec `frame-ancestors` : il est conservé
 * pour les navigateurs anciens, qui ne connaissent que lui.
 */
export const EN_TETES: Readonly<Record<string, string>> = {
  "Content-Security-Policy": CSP_ENTETE,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/**
 * Contenu du fichier `_headers` de Cloudflare Pages.
 *
 * Il est ÉCRIT PAR LE BUILD, pas versionné : c'est ce qui garantit qu'il dit
 * exactement la même chose que la balise `<meta>`.
 */
export function fichierEnTetes(): string {
  const lignes = ["/*"];
  for (const [nom, valeur] of Object.entries(EN_TETES)) {
    lignes.push(`  ${nom}: ${valeur}`);
  }
  return lignes.join("\n") + "\n";
}
