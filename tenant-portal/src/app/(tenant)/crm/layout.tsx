"use client";

import { usePathname } from "next/navigation";

// The opportunities board scrolls horizontally within its own full-height
// column rather than the page scrolling vertically, so it needs the shell's
// <main> to hand it the full remaining height instead of the page padding
// every other CRM screen gets.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOpportunities = pathname === "/crm/opportunities" || pathname.startsWith("/crm/opportunities/");

  return <div className={isOpportunities ? "flex h-full flex-col overflow-hidden" : undefined}>{children}</div>;
}
