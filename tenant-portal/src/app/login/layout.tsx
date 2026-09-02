import type { Metadata } from "next";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";


// Segment-level title. It flows through the root layout's
// `title.template`, so the brand stays the suffix. Arabic for the same
// reason the root default is — see src/app/layout.tsx.
export const metadata: Metadata = { title: ar.metadata.login };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
