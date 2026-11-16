"use client";

import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import {
  Button,
  ConflictDialog,
  DateTime,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { CurrencyOption } from "../currency-options";
import type { WorkspaceHistoryValueLabels } from "../hooks/useWorkspaceAuditPreview";
import type { WorkspaceSettingsConflict } from "../hooks/useWorkspaceSettings";
import {
  WORKSPACE_TRACKED_FIELDS,
  formatWorkspaceFieldValue,
  getWorkspaceFieldLabel,
  type WorkspaceSettings,
} from "../workspace-settings-contract";

interface WorkspaceConflictDialogProps {
  t: Dictionary;
  conflict: WorkspaceSettingsConflict | null;
  currencyOptions: readonly CurrencyOption[];
  loading: boolean;
  onCancel: () => void;
  onReload: () => void;
  onOverwrite: () => void;
}

export function WorkspaceConflictDialog({
  t,
  conflict,
  currencyOptions,
  loading,
  onCancel,
  onReload,
  onOverwrite,
}: WorkspaceConflictDialogProps) {
  if (!conflict) return null;
  const wsUi = t.coreSettings.workspaceUi;

  return (
    <ConflictDialog
      open={Boolean(conflict)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={wsUi.conflictModalTitle}
      description={t.crmShared.errorConflict}
      loading={loading}
      onCancel={onCancel}
      onReload={onReload}
      onOverwrite={onOverwrite}
      labels={{
        yourChanges: t.trade.conflictYours,
        theirChanges: t.trade.conflictTheirs,
        cancel: wsUi.conflictKeepDraft,
        overwrite: wsUi.conflictOverwrite,
        reload: wsUi.conflictReload,
      }}
      yourChanges={
        <div className="flex flex-col divide-y divide-line-divider">
          {WORKSPACE_TRACKED_FIELDS.map((field) => {
            const wasEdited = conflict.editedFields.includes(field);
            const label = getWorkspaceFieldLabel(field, t);
            const baseText = formatWorkspaceFieldValue(
              field,
              conflict.base[field],
              t,
              currencyOptions,
            );
            const draftText = formatWorkspaceFieldValue(
              field,
              conflict.draft[field],
              t,
              currencyOptions,
            );

            return (
              <div key={field} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-badge text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    "text-end text-badge font-semibold",
                    wasEdited ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {wasEdited ? (
                    <>
                      <bdi>{baseText}</bdi>
                      {" → "}
                      <bdi>{draftText}</bdi>
                      {` (${wsUi.conflictEditedTag})`}
                    </>
                  ) : (
                    <>
                      <bdi>{draftText}</bdi>
                      {` (${wsUi.conflictUnchangedTag})`}
                    </>
                  )}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2 pt-1.5">
            <span className="text-badge text-muted-foreground">{wsUi.conflictBaseTimestamp}</span>
            <span className="text-badge font-medium text-foreground-secondary">
              <DateTime value={conflict.base.updatedAt} />
            </span>
          </div>
        </div>
      }
      theirChanges={
        <div className="flex flex-col divide-y divide-line-divider">
          {WORKSPACE_TRACKED_FIELDS.map((field) => {
            const changedOnServer = conflict.server[field] !== conflict.base[field];
            const label = getWorkspaceFieldLabel(field, t);
            const serverText = formatWorkspaceFieldValue(
              field,
              conflict.server[field],
              t,
              currencyOptions,
            );

            return (
              <div key={field} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-badge text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    "text-end text-badge font-semibold",
                    changedOnServer ? "text-warning-subtle-foreground" : "text-foreground",
                  )}
                >
                  <bdi>{serverText}</bdi>
                  {changedOnServer ? ` (${wsUi.conflictChangedOnServer})` : null}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2 pt-1.5">
            <span className="text-badge text-muted-foreground">
              {t.coreIdentity.detail.updatedAt}
            </span>
            <span className="text-badge font-medium text-foreground-secondary">
              <DateTime value={conflict.server.updatedAt} />
            </span>
          </div>
        </div>
      }
    />
  );
}

interface WorkspaceHistoryModalProps {
  t: Dictionary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: WorkspaceSettings | null;
  valueLabels: WorkspaceHistoryValueLabels;
}

export function WorkspaceHistoryModal({
  t,
  open,
  onOpenChange,
  settings,
  valueLabels,
}: WorkspaceHistoryModalProps) {
  const refreshStamp = settings ? Date.parse(settings.updatedAt) : undefined;
  const normalizedRefreshToken =
    refreshStamp !== undefined && !Number.isNaN(refreshStamp) ? refreshStamp : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{t.audit.historyTitle}</DialogTitle>
          <DialogDescription className="text-xs">
            {t.coreOperations.audit.historyDescription}
          </DialogDescription>
        </DialogHeader>

        {open && settings ? (
          <div className="max-h-[65vh] overflow-y-auto pe-1">
            <RecordHistoryTab
              entityType="WorkspaceSettingsEntity"
              entityId={settings.id}
              refreshToken={normalizedRefreshToken}
              valueLabels={valueLabels}
              density="compact"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
