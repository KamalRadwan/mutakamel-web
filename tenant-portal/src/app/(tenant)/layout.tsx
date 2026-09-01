import { cookies } from "next/headers";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";
import { AppShell, NAV_APP_COOKIE, storedAppOrDefault, type SidebarState } from "@/design-system";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialSidebarState: SidebarState =
    cookieStore.get("tenant_sidebar")?.value === "collapsed" ? "collapsed" : "expanded";
  // The app scope resolves server-side for the same reason the collapse state
  // does: the sidebar's contents are server-rendered, so reading the
  // preference here keeps the first painted frame correct without a fourth
  // entry in app/layout.tsx's inline bootstrap. It is only the fallback — a
  // route that belongs to an app outranks it.
  const initialApp = storedAppOrDefault(cookieStore.get(NAV_APP_COOKIE)?.value);

  return (
    <TenantPortalRuntime>
      <AppShell initialSidebarState={initialSidebarState} initialApp={initialApp}>
        {children}
      </AppShell>
    </TenantPortalRuntime>
  );
}
