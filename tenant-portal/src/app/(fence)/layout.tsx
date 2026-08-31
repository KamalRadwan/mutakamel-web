import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";

// The terminal fences: session expiry, a suspended account, a maintenance
// window and a blocked entitlement. They render without AppShell — the shell's
// navigation would offer routes the user cannot reach — but they keep the host
// admission, the language provider and the theme.
export default function FenceLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
