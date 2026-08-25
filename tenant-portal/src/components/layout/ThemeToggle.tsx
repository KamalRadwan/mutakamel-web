"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { safeStorage } from "@/lib/safeStorage";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      const theme = safeStorage.getItem("theme");
      const isDarkMode = theme === "dark"
        || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setIsDark(isDarkMode);
      document.documentElement.classList.toggle("dark", isDarkMode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      safeStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      safeStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:p-2 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      )}
    </button>
  );
}
