// ── Infobulle sur écran tactile ──────────────────────────────────────────
//
// Sur un écran tactile, il n'existe pas de « sortie du doigt » : aucun
// `mouseleave` n'est émis quand le doigt se lève. Recharts garde donc
// `isTooltipActive` à `true` indéfiniment et l'infobulle reste collée à
// l'écran, masquant le graphique. Constaté sur A56 le 11/08/2026.
//
// Le levier existe côté Recharts : `generateCategoricalChart.js:1277` calcule
// `isActive = tooltipItem.props.active ?? isTooltipActive`. Fournir `active`
// prend le pas sur l'état interne, `undefined` rend la main au comportement
// automatique.
//
// ⚠️ PREMIÈRE TENTATIVE, ABANDONNÉE : effacer après un délai déclenché par
// `touchend`. Elle n'a pas fonctionné sur l'appareil réel. `touchend` n'est
// pas émis lorsque le navigateur reprend la main sur le geste pour faire
// défiler la page — il émet `touchcancel` — et la page Dépenses fait dix
// écrans de haut, donc le défilement est la règle plutôt que l'exception.
//
// RÈGLE RETENUE : l'infobulle n'est visible QUE tant que le doigt touche
// l'écran. Aucun délai, aucun compte à rebours : le doigt se lève ou le geste
// est annulé, l'infobulle disparaît dans la foulée. Un état ne peut pas
// « rester coincé » puisqu'il n'y a rien à expirer.

import { useCallback, useState } from "react";

export interface InfobulleTactile {
  /**
   * À passer en `active` au `<Tooltip>`. Vaut `undefined` tant qu'aucun
   * toucher n'a eu lieu — le survol souris sur PC est donc intact — puis
   * suit la présence du doigt sur l'écran.
   */
  active: false | undefined;
  /** À étaler sur le conteneur qui englobe les graphiques. */
  handlers: {
    onTouchStart: () => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

export function useInfobulleTactile(): InfobulleTactile {
  // Tant qu'aucun toucher n'a eu lieu, on ne présume rien : une souris peut
  // très bien piloter un écran tactile, et forcer `false` d'emblée priverait
  // ce cas d'infobulle sans raison.
  const [tactile, setTactile] = useState(false);
  const [doigtPose, setDoigtPose] = useState(false);

  const onTouchStart = useCallback(() => {
    setTactile(true);
    setDoigtPose(true);
  }, []);

  // `touchend` ET `touchcancel` mènent au même état : dans les deux cas le
  // doigt ne pilote plus rien. C'est l'oubli de `touchcancel` qui avait fait
  // échouer la première version.
  const relacher = useCallback(() => setDoigtPose(false), []);

  return {
    active: !tactile ? undefined : doigtPose ? undefined : false,
    handlers: {
      onTouchStart,
      onTouchEnd: relacher,
      onTouchCancel: relacher,
    },
  };
}
