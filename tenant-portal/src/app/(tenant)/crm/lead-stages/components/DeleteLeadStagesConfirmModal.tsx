"use client";

import { ConfirmActionModal, DeletionBlockerDialog } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadStageItem } from "../lead-stage-contract";

interface DeleteModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  item: LeadStageItem | null;
  error: string | null;
  blocked?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadStagesConfirmModal({ isOpen, isSubmitting, item, error, blocked, onClose, onConfirm }: DeleteModalProps) {
  const { t, lang } = useI18n();
  const name = localizedName(item, lang);

  if (blocked) return <DeletionBlockerDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}
    recordName={name} blockers={[{ id: "leads", label: t.crmLeadStages.leadsBlocker }]}
    labels={{ title: t.crmLeadStages.deleteBlockedTitle, description: error ?? t.crmLeadStages.leadsBlocker,
      blockersHeading: t.crmLeadStages.deleteBlockers, view: t.common.actions, close: t.common.close }} />;

  return (
    <ConfirmActionModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmLeadStages.deleteTitle}
      description={error ?? t.crmLeadStages.deleteMessage(name)}
      confirmLabel={isSubmitting ? t.crmLeadStages.deleting : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isSubmitting}
    />
  );
}
