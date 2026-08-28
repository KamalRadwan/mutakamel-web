"use client";

import { useEffect } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { useDirection, useLanguage } from "./useLanguage";

// Radix's keyboard navigation (Tabs, Select, DropdownMenu arrow keys) stays
// LTR regardless of what is on screen unless the tree is wrapped once here.
//
// Also keeps <html lang>/<html dir> in sync after the first paint. The
// beforeInteractive bootstrap script in src/app/layout.tsx only sets them
// once, before hydration — Tailwind's rtl:/ltr: variants (e.g. Switch's
// thumb travel) read the live dir attribute, so a runtime language toggle
// needs this effect or they go stale.
export function DirectionBridge({ children }: { children: React.ReactNode }) {
  const lang = useLanguage();
  const dir = useDirection();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
}
