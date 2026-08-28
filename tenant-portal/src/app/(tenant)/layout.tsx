import { cookies } from "next/headers";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";
import { AppShell } from "@/design-system/shell/AppShell";
import type { SidebarState } from "@/design-system/shell/useSidebar";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialSidebarState: SidebarState =
    cookieStore.get("tenant_sidebar")?.value === "collapsed" ? "collapsed" : "expanded";

  return (
    <TenantPortalRuntime>
      <AppShell initialSidebarState={initialSidebarState}>{children}</AppShell>
    </TenantPortalRuntime>
  );
}
