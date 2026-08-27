"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeToggle } from "./hooks/useThemeToggle";

export function ThemeToggle() {
  const { isDark, toggleTheme, title } = useThemeToggle();

  return (
    <button
      onClick={toggleTheme}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground dark:hover:bg-ink-800"
      title={title}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
