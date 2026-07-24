import { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { SettingsSidebar } from "./components/SettingsSidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
        <SettingsSidebar />

        <div className="flex-1 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
