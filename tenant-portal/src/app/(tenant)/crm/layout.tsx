"use client";

import { usePathname } from "next/navigation";

// The pipeline screen's old markup manages its own full-height layout and
// needs this wrapper until phase 4 converts it. AppShell's <main> now owns
// the shell chrome and page padding; this layout no longer duplicates either.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPipeline = pathname === "/crm/pipeline" || pathname.startsWith("/crm/pipeline/");

  return <div className={isPipeline ? "flex h-full flex-col overflow-hidden" : undefined}>{children}</div>;
}
