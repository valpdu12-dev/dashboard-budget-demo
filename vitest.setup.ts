import "@testing-library/jest-dom";

// ── ResizeObserver, absent de jsdom ──────────────────────────────────────
//
// Lot C.5. Recharts mesure son conteneur avec `ResizeObserver`, que jsdom ne
// fournit pas : rendre une page entière levait « ResizeObserver is not
// defined ». C'est ce qui a empêché jusqu'ici de tester un ÉCRAN COMPLET —
// seuls les hooks et les petits composants l'étaient.
//
// Le bouchon ne mesure rien : il rend des dimensions nulles, et les
// graphiques se dessinent vides. Ce n'est pas un problème ici : les quatre
// cas du C.5 vérifient le TEXTE des écrans — cartes, messages, légendes —
// pas la géométrie des courbes. Un graphique se regarde, il ne se teste pas
// en jsdom.
class ResizeObserverBouchon {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverBouchon;
}

// Silence les console.error de React (propTypes, act(), etc.) dans les tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("ReactDOM.render") ||
        args[0].includes("act(") ||
        args[0].includes("Warning:"))
    ) {
      return;
    }
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
