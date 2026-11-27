// ── Un montant au téléphone, centimes en gris ────────────────────────────────
// « 10 520,16 € » devient « 10 520 » + « ,16 € » plus clair. Le texte reste
// EXACTEMENT le même (mêmes caractères, sans espace ajoutée) : seule la couleur
// des centimes change. Un texte sans centimes (« 332 », « 83,2 % », « 161,7 k€ »)
// passe tel quel.
import { centimesAPart } from "@/utils/telephone";

export function MontantTelephone({ texte }: { texte: string }) {
  const morceaux = centimesAPart(texte);
  if (!morceaux) return <>{texte}</>;
  return (
    <>
      {morceaux[0]}
      <span className="text-text-sec">{morceaux[1]}</span>
    </>
  );
}
