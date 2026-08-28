import { cookies } from "next/headers";
import { AppShell } from "@/design-system";

// Reading the ds_sidebar cookie here — instead of only in useSidebar's
// client-side useState initializer — lets the very first server-rendered
// HTML already have the sidebar at the right width, so there is no
// collapse-flash on load/refresh (docs/design-system/shell-and-navigation.md).
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultSidebarCollapsed = cookieStore.get("ds_sidebar")?.value === "collapsed";

  return <AppShell defaultSidebarCollapsed={defaultSidebarCollapsed}>{children}</AppShell>;
}
