"use client";

import { IdentifierText, PermissionGate } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { useAddonAssignments } from "../hooks/useAddonAssignments";
import type { useAddonAssignmentOptions } from "../hooks/useAddonAssignmentOptions";
import { AddonAssignmentCommand } from "./AddonAssignmentCommand";
import { AddonAssignmentRecovery } from "./AddonAssignmentRecovery";

type ReadFields = "requestedUserId" | "snapshotKey" | "data" | "loading" | "denied" | "error" | "reload";
type Props = { userId: string } & (
  { kind: "ASSIGNMENTS"; read: Pick<ReturnType<typeof useAddonAssignments>, ReadFields> }
  | { kind: "OPTIONS"; read: Pick<ReturnType<typeof useAddonAssignmentOptions>, ReadFields> }
);

// The exact current read supplies observed pins; server authorization remains authoritative.
export function AddonSeatCommandPanel(props: Props) {
  const { user, isAuthenticated } = useTenantAuth();
  const { t } = useI18n();
  const { read, userId } = props;
  const manage = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.includes("applications.addon_seats.manage"));
  const wrongTarget = read.requestedUserId !== userId || read.data?.items.some((row) => row.userId !== userId) === true;
  const denied = wrongTarget || read.denied || [401, 403, 404].includes(read.error?.status ?? 0);
  const rowsCurrent = !read.loading && read.error === null && read.data !== null && read.snapshotKey !== null;
  if (!manage) return null;
  return <PermissionGate require={[]} denied={denied}>
    <div className="min-w-0 space-y-4">
      <section aria-label={t.addonAssignmentCommand.manageTitle} className="min-w-0 space-y-3">
        <h2 className="text-sm font-medium">{t.addonAssignmentCommand.manageTitle}</h2>
        {!rowsCurrent ? <p role="status" className="text-sm text-muted-foreground">{t.addonAssignmentCommand.refreshInputs}</p>
          : <ul className="space-y-3">{props.kind === "OPTIONS"
            ? props.read.data?.items.map((row) => <li key={`${read.snapshotKey}:${row.addonSelectionId}`} className="min-w-0 space-y-2">
              <IdentifierText>{row.addonKey}</IdentifierText>
              <AddonAssignmentCommand userId={userId} source={{ kind: "OPTION", row }} onReload={read.reload} />
            </li>)
            : props.read.data?.items.map((row) => <li key={`${read.snapshotKey}:${row.assignmentId}`} className="min-w-0 space-y-2">
              <IdentifierText>{row.addonKey}</IdentifierText>
              <AddonAssignmentCommand userId={userId} source={{ kind: "ASSIGNMENT", row }} onReload={read.reload} />
            </li>)}</ul>}
      </section>
      <AddonAssignmentRecovery key={`${userId}:${user?.id}`} userId={userId} onReload={read.reload} readSnapshotKey={read.snapshotKey} />
    </div>
  </PermissionGate>;
}
