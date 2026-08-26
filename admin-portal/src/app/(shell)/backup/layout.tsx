import type { ReactNode } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { BackupModuleNav } from "@/features/admin/backup/components/BackupModuleNav";

// The negative margin cancels AppShell's <main> padding so BackupModuleNav's
// own edge-to-edge header keeps spanning full width — it was designed to sit
// flush below the old full-bleed Navbar. Phase 18 converts BackupModuleNav's
// tab row onto the shared SubNav component; this layout is untouched then.
export default function BackupLayout({ children }: { children: ReactNode }) {
  return (
    <RequirePermission permission="admin.backups.read">
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
        <BackupModuleNav />
      </div>
      <div className="pt-4">{children}</div>
    </RequirePermission>
  );
}
