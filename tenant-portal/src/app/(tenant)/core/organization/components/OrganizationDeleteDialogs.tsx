"use client";

import { AlertTriangle } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  ConfirmActionModal,
  DeletionBlockerDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  iconSize,
} from "@/design-system";
import type { NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import type { OrgLevel, OrgNodeOf } from "../../contracts/organization-contract";
import { useOrganizationDeleteDialogs } from "../hooks/useOrganizationDeleteDialogs";
import type { OrgLevelConfig } from "../level-config";

interface OrganizationDeleteDialogsProps<L extends OrgLevel> {
  config: OrgLevelConfig;
  pendingDelete: OrgNodeOf<L> | null;
  isSubmitting: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  blockedNode: OrgNodeOf<L> | null;
  blockers: readonly string[];
  onDismissBlockers: () => void;
  hqTransferBlockedNode: OrgNodeOf<L> | null;
  hqTransferError: NormalizedApiError | null;
  onDismissHqTransfer: () => void;
}

export function OrganizationDeleteDialogs<L extends OrgLevel>({
  config,
  pendingDelete,
  isSubmitting,
  onConfirmDelete,
  onCancelDelete,
  blockedNode,
  blockers,
  onDismissBlockers,
  hqTransferBlockedNode,
  hqTransferError,
  onDismissHqTransfer,
}: OrganizationDeleteDialogsProps<L>) {
  const { t, copy, blockerItems, hqMessage } = useOrganizationDeleteDialogs(
    config,
    blockers,
    hqTransferError,
  );
  const levelCopy = copy.levels[config.level];

  return (
    <>
      <ConfirmActionModal
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) onCancelDelete();
        }}
        title={levelCopy.deleteTitle}
        description={formatTemplate(levelCopy.deleteMessage, {
          name: pendingDelete?.name ?? "",
        })}
        confirmLabel={copy.actions.delete}
        cancelLabel={t.common.cancel}
        onConfirm={onConfirmDelete}
        loading={isSubmitting}
      />

      <DeletionBlockerDialog
        open={blockedNode !== null}
        onOpenChange={(open) => {
          if (!open) onDismissBlockers();
        }}
        recordName={blockedNode?.name ?? ""}
        blockers={blockerItems}
        labels={{
          title: t.deletionBlocker.title,
          description: t.deletionBlocker.description,
          blockersHeading: t.deletionBlocker.blockersHeading,
          view: t.deletionBlocker.view,
          close: t.deletionBlocker.close,
        }}
      />

      <Dialog
        open={hqTransferBlockedNode !== null}
        onOpenChange={(open) => {
          if (!open) onDismissHqTransfer();
        }}
      >
        <DialogContent size="lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle
                className={cn(iconSize({ size: "xl" }), "text-warning")}
                aria-hidden="true"
              />
              {t.deletionBlocker.title}
            </DialogTitle>
            <DialogDescription>{hqMessage}</DialogDescription>
          </DialogHeader>

          {hqTransferBlockedNode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-muted/40 p-2.5">
              <span className="text-xs font-medium text-foreground">
                {hqTransferBlockedNode.name}
              </span>
              <Badge tone="brand">{copy.fields.headquarters}</Badge>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onDismissHqTransfer}>
              {copy.actions.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
