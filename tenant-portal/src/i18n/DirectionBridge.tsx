"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import { useDirection } from "./useLanguage";

// Radix's keyboard navigation (Tabs, Select, DropdownMenu arrow keys) stays
// LTR regardless of what is on screen unless the tree is wrapped once here.
export function DirectionBridge({ children }: { children: React.ReactNode }) {
  const dir = useDirection();
  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
}
