"use client";

import { ConflictDialog } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { EmailConflictKind } from "../hooks/useEmailConfig";

interface EmailConflictDialogProps {
  kind: EmailConflictKind | null;
  onReload: () => void;
  onCancel: () => void;
  loading: boolean;
}

/**
 * MASTER-PLAN 5.9 and 5.17. Two precondition failures, two different answers:
 *
 * - **428** `TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED` — the write carried no
 *   `If-Match`. Nothing was overwritten and nobody else changed anything;
 *   reloading restores a usable precondition.
 * - **409** `TENANT_EMAIL_CONFIG_STALE_REVISION` — the revision was malformed
 *   or has moved on. Someone else saved while this form was open, and the
 *   pending edit would silently discard their change.
 *
 * `onOverwrite` is omitted in both cases on purpose: the server has no forced
 * write, so offering the button would invite the user to press something that
 * cannot work.
 */
export function EmailConflictDialog({
  kind,
  onReload,
  onCancel,
  loading,
}: EmailConflictDialogProps) {
  const { t } = useI18n();
  const isStale = kind === "staleRevision";

  return (
    <ConflictDialog
      open={kind !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={isStale ? t.coreSettings.emailStaleTitle : t.coreSettings.emailPreconditionTitle}
      description={
        isStale ? t.coreSettings.emailStaleDescription : t.coreSettings.emailPreconditionDescription
      }
      onReload={onReload}
      onCancel={onCancel}
      loading={loading}
      labels={{
        yourChanges: t.coreSettings.emailYourChanges,
        theirChanges: t.coreSettings.emailTheirChanges,
        reload: t.coreSettings.emailReloadConfig,
        overwrite: t.coreSettings.emailOverwrite,
        cancel: t.common.cancel,
      }}
    />
  );
}
