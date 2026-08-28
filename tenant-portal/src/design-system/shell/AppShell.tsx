"use client";

import { useState } from "react";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useNavTree } from "./useNavTree";
import { useSidebar, type SidebarState } from "./useSidebar";

export interface AppShellProps {
  children: React.ReactNode;
  // Read server-side from the tenant_sidebar cookie in
  // app/(tenant)/layout.tsx — the one shell dimension genuinely resolved
  // server-side, so there is no collapse flash on first paint. A first-ever
  // visitor (no cookie yet) starts expanded; this does not implement
  // shell.md's viewport-conditional default (collapsed at lg-xl, expanded
  // at xl+), which would need a hydration-unsafe viewport read to do
  // server-side.
  initialSidebarState: SidebarState;
}

export function AppShell({ children, initialSidebarState }: AppShellProps) {
  const { state } = useSidebar(initialSidebarState);
  const sections = useNavTree();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <div className="hidden lg:block">
        <Sidebar sections={sections} state={state} />
      </div>
      <MobileNav sections={sections} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMobileMenuOpen={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
