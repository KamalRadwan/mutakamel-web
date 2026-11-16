"use client";

import { ConfirmActionModal, DeletionBlockerDialog } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CrmTagCatalogueItem } from "../../shared/tag-contract";

interface DeleteCrmTagConfirmModalProps {
  tag: CrmTagCatalogueItem | null;
  error: string | null;
  isSubmitting: boolean;
  blocked: boolean;
  leadCount?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmTagConfirmModal({ tag, error, isSubmitting, blocked, leadCount, onClose, onConfirm }: DeleteCrmTagConfirmModalProps) {
  const { t } = useI18n();
  const message = formatTemplate(t.crmTags.deleteMessage, { name: tag?.name ?? "" });

  if (blocked) return <DeletionBlockerDialog open={tag !== null}
    onOpenChange={(open) => { if (!open) onClose(); }} recordName={tag?.name ?? ""}
    blockers={[{ id: "leads", label: t.crmTags.liveLeads, count: leadCount }]}
    labels={{ title: t.crmTags.deleteBlockedTitle, description: error ?? t.crmTags.errors.detachLimit,
      blockersHeading: t.crmTags.deleteBlockers, view: t.common.actions, close: t.common.close }} />;

  return (
    <ConfirmActionModal
      open={tag !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmTags.deleteTitle}
      description={error ? `${message} ${error}` : message}
      confirmLabel={isSubmitting ? t.crmTags.deleting : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isSubmitting}
    />
  );
}
