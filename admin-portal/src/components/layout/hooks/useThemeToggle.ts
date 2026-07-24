"use client";

import { useEffect, useState } from "react";

export function useThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    // If explicit savedTheme exists, use it; otherwise check if dark class is present
    const isDarkMode = savedTheme 
      ? savedTheme === "dark" 
      : document.documentElement.classList.contains("dark");

    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return {
    isDark,
    mounted,
    toggleTheme,
    title: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
  };
}
