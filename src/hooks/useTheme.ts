import { useEffect } from "react";
import type { Settings } from "../validation/settings.schema.ts";

const THEME_COLOR_LIGHT = "#2D5016";
const THEME_COLOR_DARK = "#1a2e0e";

export function useTheme(theme: Settings["theme"], highContrast: boolean) {
  // Toggle .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;

    function applyDark(dark: boolean) {
      root.classList.toggle("dark", dark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute("content", dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
      }
    }

    if (theme === "dark") {
      applyDark(true);
      return;
    }
    if (theme === "light") {
      applyDark(false);
      return;
    }

    // Auto mode — follow system preference
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyDark(mq.matches);

    const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Toggle .high-contrast class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);
}
