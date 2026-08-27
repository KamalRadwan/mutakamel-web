"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useI18n } from "@/i18n/I18nContext";

export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Before mount, resolvedTheme is unknown to next-themes on the client —
  // fall back to the layout's defaultTheme ("dark") so the icon matches
  // what was actually painted rather than flashing once mounted flips.
  const isDark = mounted ? resolvedTheme === "dark" : true;

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return {
    isDark,
    mounted,
    toggleTheme,
    title: isDark ? t.common.switchToLightMode : t.common.switchToDarkMode,
  };
}
