"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadStageItem } from "../lead-stage-contract";

interface DeleteModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  item: LeadStageItem | null;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadStagesConfirmModal({ isOpen, isSubmitting, item, error, onClose, onConfirm }: DeleteModalProps) {
  const { t, lang } = useI18n();
  const name = localizedName(item, lang);

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
