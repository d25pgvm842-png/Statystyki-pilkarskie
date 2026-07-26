"use client";

import { useEffect } from "react";
import {
  safeBrowserPreference,
  safeReadBrowserStorage,
} from "@/lib/browser/safe-browser-storage";

const STORAGE_KEY = "staty-theme";
const THEME_EVENT = "staty-theme-change";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const savedTheme = safeReadBrowserStorage(
      () => window.localStorage,
      STORAGE_KEY,
    );
    const prefersDark = safeBrowserPreference(
      () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const dark = savedTheme ? savedTheme === "dark" : prefersDark;

    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return <>{children}</>;
}
