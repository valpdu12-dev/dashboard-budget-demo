/**
 * DM-01 (A8) — un objet SANS propriétés héritées, pour regrouper par nom.
 *
 * Un objet ordinaire `{}` hérite de `constructor`, `toString`, `__proto__`…
 * Quand la clé est un nom choisi par l'utilisateur (catégorie, compte, type,
 * enseigne), ces noms donnent un montant faux (« constructor » vaut la
 * fonction Object au lieu de rien) ou perdu (`o["__proto__"] = 5` ne crée
 * aucune clé). Un objet créé par `Object.create(null)` n'hérite de rien :
 * chaque nom est une clé comme les autres.
 *
 * Test : `src/__tests__/calculs/nomsPieges.test.ts`.
 */
export function dictionnaire<T extends object = Record<string, never>>(init?: T): T {
  return Object.assign(Object.create(null), init) as T;
}
