// ── Mapping compte → organisme (source unique, aligné V1) ───────────────
import { COMPTE_TO_ORGANISME } from "@/config/constants";
import type { Organisme } from "@/types";

/** Retourne l'organisme bancaire associé à un compte */
export function toOrganisme(compte: string): Organisme {
  return (COMPTE_TO_ORGANISME[compte] as Organisme) ?? "Autre";
}
