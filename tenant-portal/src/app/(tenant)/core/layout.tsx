"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";

export default function CoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#090d16] overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-45px)]">
        <Sidebar />
        <main className="flex-1 w-full p-3 md:p-4 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
