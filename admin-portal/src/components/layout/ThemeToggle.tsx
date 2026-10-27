"use client";

import { Moon, Sun } from "lucide-react";
import { Button, cn } from "@/design-system";
import { useThemeToggle } from "./hooks/useThemeToggle";

export function ThemeToggle({ tone = "surface" }: { tone?: "surface" | "chrome" }) {
  const { isDark, toggleTheme, title } = useThemeToggle();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        "size-9 shrink-0 rounded-full border p-0",
        tone === "chrome"
          ? "border-nav-chrome-line bg-white/5 text-nav-foreground hover:bg-white/10 hover:text-nav-foreground-strong"
          : "border-line-control bg-surface-subtle text-foreground-secondary hover:bg-accent hover:text-foreground",
      )}
      aria-label={title}
      title={title}
    >
      {isDark ? (
        <Sun className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Moon className="size-4 shrink-0" aria-hidden="true" />
      )}
    </Button>
  );
}
