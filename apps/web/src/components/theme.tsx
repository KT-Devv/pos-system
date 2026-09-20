"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@pos/shared";
import { Moon, Sun } from "lucide-react";

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "pos-theme";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * Theme choice persisted in localStorage and applied as data-theme on <html>.
 * The inline script in the root layout applies it before first paint; this hook
 * keeps React state and the attribute in sync afterwards.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const choice = readStoredTheme();
      setThemeState(choice);
      setResolved(choice === "system" ? (media.matches ? "dark" : "light") : choice);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    const root = document.documentElement;
    try {
      if (choice === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* storage can be blocked; the choice still applies for this page view */
    }
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    setThemeState(choice);
    setResolved(choice === "system" ? (systemPrefersDark() ? "dark" : "light") : choice);
  }, []);

  return { theme, resolved, setTheme };
}

/** Icon button that flips between light and dark. */
export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {resolved === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
