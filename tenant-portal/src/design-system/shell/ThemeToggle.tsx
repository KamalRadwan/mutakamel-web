"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useTheme, type Theme } from "../theme/ThemeProvider";
import { Button } from "../primitives/Button";

const NEXT_THEME: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

// Cycles light -> dark -> system. Before mount, useTheme()'s server
// snapshot is "system", matching this component's default render, so it
// never visibly flips as the stored value resolves — see
// docs/design/theming.md#the-toggles.
export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const nextLabel =
    NEXT_THEME[theme] === "light" ? t.common.switchToLight : NEXT_THEME[theme] === "dark" ? t.common.switchToDark : t.common.switchToSystem;

  return (
    <Button variant="ghost" size="sm" onClick={() => setTheme(NEXT_THEME[theme])} aria-label={nextLabel}>
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}
