"use client";

import { Button, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useAddonAssignmentRecovery } from "../hooks/useAddonAssignmentRecovery";
import { AddonAssignmentCommand } from "./AddonAssignmentCommand";

// Independent of current-row membership: removal may have committed before its response was lost.
export function AddonAssignmentRecovery({ userId, onReload, readSnapshotKey = null }: {
  userId: string; onReload: () => void | Promise<void>; readSnapshotKey?: string | null;
}) {
  const { t } = useI18n();
  const recovery = useAddonAssignmentRecovery(userId, readSnapshotKey);
  return <PermissionGate require={[]} denied={recovery.denied}>
    <section aria-label={t.addonAssignmentCommand.recoveryTitle} className="min-w-0 space-y-3 rounded-md border border-border p-4">
      <h2 className="text-sm font-medium">{t.addonAssignmentCommand.recoveryTitle}</h2>
      <p className="text-xs text-muted-foreground">{t.addonAssignmentCommand.recoveryNotice}</p>
      <Button variant="outline" onClick={recovery.reload} disabled={!recovery.ready || recovery.loading}>{t.coreBilling.reload}</Button>
      {recovery.loading ? <p role="status" className="text-sm">{t.addonAssignmentCommand.sessionPending}</p>
        : recovery.error ? <p role="alert" className="text-sm text-destructive">{t.addonAssignmentCommand.storageFailed}</p>
          : recovery.items.length === 0 ? <p className="text-sm text-muted-foreground">{t.addonAssignmentCommand.noRetained}</p>
            : <ul className="space-y-3">{recovery.items.map((source) => <li key={source.row.addonSelectionId} className="min-w-0 space-y-2">
              <AddonAssignmentCommand userId={userId} source={source} onReload={onReload} />
            </li>)}</ul>}
    </section>
  </PermissionGate>;
}
