import type { ReactNode } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Navbar } from "@/components/layout/Navbar";
import { BackupModuleNav } from "@/features/admin/backup/components/BackupModuleNav";

export default function BackupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-canvas dark:text-slate-100">
      <Navbar />

      <RequirePermission permission="admin.backups.read">
        <BackupModuleNav />
        <main className="w-full flex-1 px-4 py-4 sm:py-6">
          {children}
        </main>
      </RequirePermission>
    </div>
  );
}
