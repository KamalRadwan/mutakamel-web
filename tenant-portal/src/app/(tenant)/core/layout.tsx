import type { Metadata } from "next";
import { ar } from "@/i18n/dictionaries/ar";

// Segment-level title. It flows through the root layout's
// `title.template`, so the brand stays the suffix. Arabic for the same
// reason the root default is — see src/app/layout.tsx.
export const metadata: Metadata = { title: ar.nav.appWorkspace };

export default function CoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
