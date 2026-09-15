import "@testing-library/jest-dom";

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
