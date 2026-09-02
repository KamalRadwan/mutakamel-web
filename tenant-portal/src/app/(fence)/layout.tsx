import type { Metadata } from "next";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";


// Segment-level title. It flows through the root layout's
// `title.template`, so the brand stays the suffix. Arabic for the same
// reason the root default is — see src/app/layout.tsx.
export const metadata: Metadata = { title: ar.metadata.fence };

// The terminal fences: session expiry, a suspended account, a maintenance
// window and a blocked entitlement. They render without AppShell — the shell's
// navigation would offer routes the user cannot reach — but they keep the host
// admission, the language provider and the theme.
export default function FenceLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
