"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeToggle } from "./hooks/useThemeToggle";

export function ThemeToggle() {
  const { isDark, toggleTheme, title } = useThemeToggle();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer border border-slate-700/50 bg-slate-800/40"
      title={title}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-300" />
      )}
    </button>
  );
}
