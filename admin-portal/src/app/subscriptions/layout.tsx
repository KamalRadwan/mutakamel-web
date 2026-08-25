import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";

export default function SubscriptionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-[#090d16] dark:text-slate-100">
      <Navbar />
      <main className="w-full flex-1 px-[10px] py-4 sm:py-6">{children}</main>
    </div>
  );
}
