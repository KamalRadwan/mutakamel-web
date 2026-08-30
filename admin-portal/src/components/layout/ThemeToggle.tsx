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
      size="md"
      onClick={toggleTheme}
      className="size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
      aria-label={title}
      title={title}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
