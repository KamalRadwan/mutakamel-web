import type { Metadata } from "next";
import { loadServerLanguage } from "@/i18n/server";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary: t } = await loadServerLanguage();
  return { title: t.metadata.fence };
}

// The terminal fences: session expiry, a suspended account, a maintenance
// window and a blocked entitlement. They render without AppShell — the shell's
// navigation would offer routes the user cannot reach — but they keep the host
// admission, the language provider and the theme.
export default function FenceLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
