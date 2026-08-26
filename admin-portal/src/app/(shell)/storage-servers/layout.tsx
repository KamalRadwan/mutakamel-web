import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";

export default function StorageServersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-canvas dark:text-slate-100">
      <Navbar />
      <main className="w-full flex-1 px-4 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
