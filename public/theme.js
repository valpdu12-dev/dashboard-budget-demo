// Pose le thème AVANT l'affichage (pas d'éclair blanc ou noir).
// Chargé en script classique dans <head> (index.html) : servi par le site,
// permis par la CSP (`script-src 'self'`). Même règle que src/theme.ts (un test
// vérifie que les deux disent la même chose) : choix gardé sur l'appareil
// (« budget-apparence » = auto | jour | nuit), Auto = réglage de l'appareil.
(function () {
  var choix = "auto";
  try {
    var v = window.localStorage.getItem("budget-apparence");
    if (v === "auto" || v === "jour" || v === "nuit") choix = v;
  } catch (e) {
    // stockage refusé : Auto
  }
  var sombre = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = choix === "auto" ? (sombre ? "nuit" : "jour") : choix;
  var racine = document.documentElement;
  racine.setAttribute("data-theme", theme);
  racine.setAttribute("data-choix-theme", choix);
  var barres = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < barres.length; i++) barres[i].setAttribute("content", theme === "nuit" ? "#0b0c0f" : "#f6f5f2");
})();
