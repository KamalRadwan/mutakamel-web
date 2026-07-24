"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeToggle } from "./hooks/useThemeToggle";

export function ThemeToggle() {
  const { isDark, toggleTheme, title } = useThemeToggle();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      title={title}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );
}
