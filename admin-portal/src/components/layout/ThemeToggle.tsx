"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/design-system";
import { useThemeToggle } from "./hooks/useThemeToggle";

export function ThemeToggle() {
  const { isDark, toggleTheme, title } = useThemeToggle();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="size-7 shrink-0 p-0 text-slate-300 hover:bg-white/10 hover:text-white"
      aria-label={title}
      title={title}
    >
      {isDark ? (
        <Sun className="size-3.5" aria-hidden="true" />
      ) : (
        <Moon className="size-3.5" aria-hidden="true" />
      )}
    </Button>
  );
}
