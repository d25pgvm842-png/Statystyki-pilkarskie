export type BrowserStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function safeReadBrowserStorage(
  storage: () => BrowserStorageLike,
  key: string,
): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

export function safeWriteBrowserStorage(
  storage: () => BrowserStorageLike,
  key: string,
  value: string,
): boolean {
  try {
    storage().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeBrowserPreference(
  readPreference: () => boolean,
  fallback = false,
): boolean {
  try {
    return Boolean(readPreference());
  } catch {
    return fallback;
  }
}
