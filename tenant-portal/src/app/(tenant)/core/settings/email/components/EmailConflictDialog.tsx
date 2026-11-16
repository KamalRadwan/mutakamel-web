"use client";

import { AlertCircle, GitCompareArrows } from "lucide-react";
import {
  Button,
  ConflictDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IdentifierText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { EmailConflictReview } from "../email-config-conflict";
import type { EmailConfigStatus } from "../email-config-contract";
import type { EmailConflictKind } from "../hooks/useEmailConfig";

interface EmailConflictDialogProps {
  kind: EmailConflictKind | null;
  review: EmailConflictReview | null;
  draftStatus: EmailConfigStatus | null;
  error?: string | null;
  loading: boolean;
  onResolve: () => void;
  onAdoptLatest: () => void;
  onDiscardToLatest: () => void;
  onCancel: () => void;
}

/**
 * Keeps 428 and 409 distinct:
 * - **428** `TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED`: refreshes the missing
 *   `If-Match` precondition via `ConflictDialog`.
 * - **409** `TENANT_EMAIL_CONFIG_STALE_REVISION`: preserves the user's draft and
 *   baseline, fetches the latest server state into `review`, displays actual
 *   changed fields, and requires explicit adoption before a separate save.
 */
export function EmailConflictDialog({
  kind,
  review,
  draftStatus,
  error = null,
  loading,
  onResolve,
  onAdoptLatest,
  onDiscardToLatest,
  onCancel,
}: EmailConflictDialogProps) {
  const { t } = useI18n();

  if (kind === "preconditionRequired") {
    return (
      <ConflictDialog
        open
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
        title={t.coreSettings.emailPreconditionTitle}
        description={
          error
            ? `${t.coreSettings.emailPreconditionDescription} — ${error}`
            : t.coreSettings.emailPreconditionDescription
        }
        onReload={onResolve}
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

  const open = kind === "staleRevision";
  const showDkimSuspensionNote =
    review !== null && !review.latestConfig.dkimVerified && draftStatus === "ACTIVE";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loading) onCancel();
      }}
    >
      <DialogContent
        size={review ? "2xl" : "lg"}
        showCloseButton={!loading}
        closeLabel={t.common.close}
        aria-busy={loading || undefined}
        onEscapeKeyDown={(event) => {
          if (loading) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (loading) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <GitCompareArrows
              className="size-4 shrink-0 text-warning-vivid"
              aria-hidden="true"
            />
            {t.coreSettings.emailStaleTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t.coreSettings.emailStaleDescription}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t.coreSettings.emailConflictDraftKeptNote}
        </p>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground wrap-anywhere"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <bdi>{error}</bdi>
          </div>
        ) : null}

        {showDkimSuspensionNote ? (
          <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
            {t.coreSettings.emailConflictDkimSuspendedNote}
          </p>
        ) : null}

        {review ? (
          review.diffRows.length > 0 ? (
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">
                      {t.coreSettings.emailConflictFieldColumn}
                    </TableHead>
                    <TableHead className="text-xs">
                      {t.coreSettings.emailConflictDraftColumn}
                    </TableHead>
                    <TableHead className="text-xs">
                      {t.coreSettings.emailConflictLatestColumn}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {review.diffRows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="text-xs font-normal text-muted-foreground">
                        {row.label}
                      </TableCell>
                      <TableCell className="text-xs font-normal text-foreground">
                        {row.isIdentifier ? (
                          <IdentifierText className="text-xs font-normal">
                            {row.draftValue}
                          </IdentifierText>
                        ) : (
                          row.draftValue
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-normal text-foreground">
                        {row.isIdentifier ? (
                          <IdentifierText className="text-xs font-normal">
                            {row.latestValue}
                          </IdentifierText>
                        ) : (
                          row.latestValue
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {t.coreSettings.emailConflictNoVisibleDiff}
            </p>
          )
        ) : null}

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
            {t.common.cancel}
          </Button>
          {review ? (
            <>
              <Button size="sm" variant="outline" onClick={onDiscardToLatest} disabled={loading}>
                {t.coreSettings.emailConflictDiscardToLatestAction}
              </Button>
              <Button size="sm" variant="primary" onClick={onAdoptLatest} disabled={loading}>
                {t.coreSettings.emailConflictAdoptAction}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" onClick={onResolve} loading={loading}>
              {t.coreSettings.emailConflictReviewAction}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
