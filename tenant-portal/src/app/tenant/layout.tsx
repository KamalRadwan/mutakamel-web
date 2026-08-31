import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";

// The two single-use-token screens the invite and reset emails link to. They
// are public — the visitor has no session yet — but they still need the host
// admission, the language provider and the theme, so they run the same runtime
// the login screen does, without the AppShell.
export default function TenantActionLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
