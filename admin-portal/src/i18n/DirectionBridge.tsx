"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import { useI18n } from "./I18nContext";

/**
 * Feeds I18nContext's resolved `dir` into Radix's own direction context, so
 * Tabs/Select/DropdownMenu keyboard navigation (arrow keys, etc.) is correct
 * in RTL. Radix has no way to read our i18n state on its own.
 */
export function DirectionBridge({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
}
