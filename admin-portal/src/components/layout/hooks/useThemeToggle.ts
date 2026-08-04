"use client";

import { useEffect, useState } from "react";
import { safeStorage } from "@/lib/safeStorage";

export function useThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const savedTheme = safeStorage.getItem("theme");
    return savedTheme
      ? savedTheme === "dark"
      : document.documentElement.classList.contains("dark");
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      safeStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      safeStorage.setItem("theme", "light");
    }
  };

  return {
    isDark,
    mounted,
    toggleTheme,
    title: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
  };
}
