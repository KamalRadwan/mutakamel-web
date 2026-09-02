import type { Metadata } from "next";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";


// Segment-level title. It flows through the root layout's
// `title.template`, so the brand stays the suffix. Arabic for the same
// reason the root default is — see src/app/layout.tsx.
export const metadata: Metadata = { title: ar.metadata.actionToken };

// The two single-use-token screens the invite and reset emails link to. They
// are public — the visitor has no session yet — but they still need the host
// admission, the language provider and the theme, so they run the same runtime
// the login screen does, without the AppShell.
export default function TenantActionLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
