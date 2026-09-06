import { cookies } from "next/headers";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";
import { RouteTitle } from "@/components/tenant/RouteTitle";
import { AppShell, NAV_APP_COOKIE, storedAppOrDefault } from "@/design-system";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  // The app scope resolves server-side because the global nav's section menus
  // are server-rendered: reading the preference here keeps the first painted
  // frame correct without a fourth entry in app/layout.tsx's inline bootstrap.
  // It is only the fallback — a route that belongs to an app outranks it.
  //
  // It is the only shell dimension left to resolve. `tenant_sidebar` went with
  // the sidebar: two full-width bars have no collapsed state to remember.
  const initialApp = storedAppOrDefault(cookieStore.get(NAV_APP_COOKIE)?.value);

  return (
    <TenantPortalRuntime>
      {/* Every route under the shell gets its own translated title. */}
      <RouteTitle />
      <AppShell initialApp={initialApp}>{children}</AppShell>
    </TenantPortalRuntime>
  );
}
