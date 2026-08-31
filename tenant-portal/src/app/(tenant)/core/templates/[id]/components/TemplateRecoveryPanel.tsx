"use client";

import { History } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  DetailSection,
  EmptyState,
  ErrorState,
  Field,
  ReasonDialog,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { useCoreOperationsErrorText } from "../../../hooks/useCoreOperationsErrorText";
import type { useTemplateRecovery } from "../hooks/useTemplateRecovery";

/**
 * Recovery snapshots.
 *
 * The restore dialog collects a reason **and** an explicit discard
 * acknowledgement. Neither is defaulted: `discardCurrentDraft` is
 * `@IsIn([true])`, so agreeing to lose the current draft is the only way this
 * command exists, and it has to be said out loud.
 */
export function TemplateRecoveryPanel({
  recovery,
}: {
  recovery: ReturnType<typeof useTemplateRecovery>;
}) {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.templates;
  const describeError = useCoreOperationsErrorText();

  return (
    <DetailSection title={copy.recoveryTitle} description={copy.recoveryDescription}>
      {/* Both requirements are collected before the command can be sent: the
          acknowledgement here, the operator reason in the dialog. Neither has a
          default — `discardCurrentDraft` is `@IsIn([true])`. */}
      <Field label={copy.discardAcknowledgement} hint={copy.discardAcknowledgementHint}>
        <Checkbox
          checked={recovery.acknowledgedDiscard}
          onCheckedChange={(checked) => recovery.setAcknowledgedDiscard(checked === true)}
          disabled={recovery.isSubmitting}
        />
      </Field>

      {recovery.error ? (
        <ErrorState
          title={copy.recoveryLoadFailed}
          description={describeError(recovery.error)}
          onRetry={recovery.reload}
          retryLabel={t.common.retry}
        />
      ) : recovery.isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-busy="true">
          <Skeleton className="h-9 w-full" />
        </div>
      ) : recovery.snapshots.length === 0 ? (
        <EmptyState
          icon={History}
          title={copy.recoveryEmpty}
          description={copy.recoveryEmptyDescription}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {recovery.snapshots.map((snapshot) => {
            const unavailable =
              snapshot.integrityStatus !== "AVAILABLE" ||
              snapshot.objectDeletedAt !== null ||
              snapshot.restoredAt !== null;
            return (
              <li
                key={snapshot.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm text-foreground">
                    {formatTemplate(copy.snapshotLabel, {
                      revision: String(snapshot.sourceDraftRevision),
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTemplate(copy.snapshotExpiry, {
                      created: formatDateTime(snapshot.createdAt, lang),
                      expires: formatDateTime(snapshot.expiresAt, lang),
                    })}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {snapshot.restoredAt ? (
                    <Badge tone="neutral">{copy.snapshotRestoredBadge}</Badge>
                  ) : null}
                  {snapshot.integrityStatus !== "AVAILABLE" ? (
                    <Badge tone="negative">{copy.snapshotQuarantined}</Badge>
                  ) : null}
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={unavailable || !recovery.acknowledgedDiscard}
                    onClick={() => recovery.openRestore(snapshot)}
                  >
                    {copy.snapshotRestore}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <ReasonDialog
        open={recovery.restoring !== null}
        onOpenChange={(open) => {
          if (!open) recovery.closeRestore();
        }}
        title={copy.snapshotRestoreTitle}
        description={copy.snapshotRestoreDescription}
        reasonRequired
        destructive
        onConfirm={(reason) => void recovery.restore(reason)}
        loading={recovery.isSubmitting}
        error={recovery.formError ?? undefined}
        labels={{
          reason: copy.restoreReason,
          reasonHint: copy.snapshotReasonHint,
          confirm: copy.snapshotRestore,
          cancel: t.common.cancel,
        }}
      />
    </DetailSection>
  );
}
