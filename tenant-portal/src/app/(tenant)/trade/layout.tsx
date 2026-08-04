"use client";

import { Navbar } from "@/components/layout/Navbar";

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16]">
      <Navbar />
      <main className="flex-1 w-full p-4">{children}</main>
    </div>
  );
}
