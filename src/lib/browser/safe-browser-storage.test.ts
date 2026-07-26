import assert from "node:assert/strict";
import test from "node:test";
import {
  safeBrowserPreference,
  safeReadBrowserStorage,
  safeWriteBrowserStorage,
  type BrowserStorageLike,
} from "./safe-browser-storage";

function memoryStorage(): BrowserStorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

test("bezpieczny storage odczytuje i zapisuje wartość", () => {
  const storage = memoryStorage();

  assert.equal(safeWriteBrowserStorage(() => storage, "theme", "dark"), true);
  assert.equal(safeReadBrowserStorage(() => storage, "theme"), "dark");
});

test("wyjątek storage nie wyłącza aplikacji", () => {
  const blocked = () => {
    throw new Error("SecurityError");
  };

  assert.equal(safeReadBrowserStorage(blocked, "theme"), null);
  assert.equal(safeWriteBrowserStorage(blocked, "theme", "dark"), false);
});

test("wyjątek preferencji przeglądarki używa fallbacku", () => {
  assert.equal(safeBrowserPreference(() => true), true);
  assert.equal(
    safeBrowserPreference(() => {
      throw new Error("matchMedia unavailable");
    }, false),
    false,
  );
});
