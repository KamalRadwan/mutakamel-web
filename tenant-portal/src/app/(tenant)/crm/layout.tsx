"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPipeline = pathname.startsWith("/crm/pipeline");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16]">
      <Navbar />
      <main className={`flex-1 w-full p-4 ${isPipeline ? "overflow-hidden flex flex-col" : ""}`}>
        {children}
      </main>
    </div>
  );
}
