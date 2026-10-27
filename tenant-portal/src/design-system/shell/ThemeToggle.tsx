"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useTheme, type Theme } from "../theme/ThemeProvider";
import { Button } from "../primitives/Button";
import { cn } from "../lib/cn";

const NEXT_THEME: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

// Cycles light -> dark -> system. Before mount, useTheme()'s server
// snapshot is "system", matching this component's default render, so it
// never visibly flips as the stored value resolves — see
// docs/design/theming.md#the-toggles.
export function ThemeToggle({ tone = "surface" }: { tone?: "surface" | "chrome" }) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const nextLabel =
    NEXT_THEME[theme] === "light"
      ? t.common.switchToLight
      : NEXT_THEME[theme] === "dark"
        ? t.common.switchToDark
        : t.common.switchToSystem;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(NEXT_THEME[theme])}
      aria-label={nextLabel}
      className={cn(
        "size-9 rounded-full border px-0",
        tone === "chrome"
          ? "border-nav-chrome-line bg-white/8 text-nav-foreground not-disabled:hover:bg-white/15 not-disabled:hover:text-nav-foreground-strong"
          : "border-line-control bg-surface-subtle text-foreground-secondary not-disabled:hover:bg-accent not-disabled:hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
    </Button>
  );
}
