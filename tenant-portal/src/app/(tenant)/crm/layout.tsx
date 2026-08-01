"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPipeline = pathname.startsWith("/crm/pipeline");

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#090d16] overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-45px)]">
        <main className={`flex-1 w-full px-3 pb-3 pt-[5px] md:px-4 md:pb-4 md:pt-[5px] ${isPipeline ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
