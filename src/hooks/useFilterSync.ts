/**
 * useFilterSync — Synchronisation bidirectionnelle Filtres Zustand ↔ URL
 * (Phase 5.4, drill-down URL).
 *
 * - URL → Store au montage : applique les query params présents dans l'URL
 *   (ex. ?month=2025-03&cat2=Alimentation) aux setters correspondants du store.
 * - Store → URL à chaque changement de filtre : réécrit les query params
 *   (replace, sans empiler l'historique).
 *
 * Usage : useFilterSync({ month: "selMonth", cat2: "selCat2", type: "selType", org: "selOrg" });
 *
 * @param mapping - Map { nomParamUrl: cléStoreZustand } (clés synchronisables : SyncableFilterKey).
 * @returns void (effets de bord uniquement).
 */

import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useFilterStore } from "@/stores/useFilterStore";

/** Clés de filtre du store qui peuvent être synchronisées avec l'URL */
type SyncableFilterKey =
  | "selMonth" | "selCat2" | "selType" | "selOrg"
  | "selRecMonth" | "selRecType"
  | "selEpMonth" | "selEpType"
  | "selEntreprise" | "selYear"
  | "period";

/** Map paramètre URL → clé du store Zustand */
type ParamMapping = Record<string, SyncableFilterKey>;

/** Setters correspondants dans le store */
const SETTER_MAP: Record<SyncableFilterKey, string> = {
  selMonth:      "setSelMonth",
  selCat2:       "setSelCat2",
  selType:       "setSelType",
  selOrg:        "setSelOrg",
  selRecMonth:   "setSelRecMonth",
  selRecType:    "setSelRecType",
  selEpMonth:    "setSelEpMonth",
  selEpType:     "setSelEpType",
  selEntreprise: "setSelEntreprise",
  selYear:       "setSelYear",
  period:        "setPeriod",
};

/**
 * Synchronise les filtres Zustand avec les query params de l'URL.
 *
 * @param mapping - Object { urlParamName: storeKey }
 *   Ex : { month: "selMonth", cat2: "selCat2" }
 *   → ?month=2025-03&cat2=Alimentation
 */
export function useFilterSync(mapping: ParamMapping) {
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useFilterStore();
  const isInitRef = useRef(false);
  const prevUrlRef = useRef("");

  // ── 1. URL → Store (au montage uniquement) ──────────────────────────
  useEffect(() => {
    if (isInitRef.current) return;
    isInitRef.current = true;

    const storeState = useFilterStore.getState();
    for (const [urlParam, storeKey] of Object.entries(mapping)) {
      const urlValue = searchParams.get(urlParam);
      if (urlValue && urlValue !== storeState[storeKey]) {
        const setterName = SETTER_MAP[storeKey];
        if (setterName && typeof (storeState as unknown as Record<string, unknown>)[setterName] === "function") {
          (storeState as unknown as Record<string, (...args: unknown[]) => void>)[setterName](urlValue);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Store → URL (à chaque changement de filtre) ──────────────────
  useEffect(() => {
    const params = new URLSearchParams();

    for (const [urlParam, storeKey] of Object.entries(mapping)) {
      const value = store[storeKey];
      if (value != null && value !== "") {
        params.set(urlParam, String(value));
      }
    }

    const newUrl = params.toString();
    if (newUrl !== prevUrlRef.current) {
      prevUrlRef.current = newUrl;
      setSearchParams(params, { replace: true });
    }
  });
}
