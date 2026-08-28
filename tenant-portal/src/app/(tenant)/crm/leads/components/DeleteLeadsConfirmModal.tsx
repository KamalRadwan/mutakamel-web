"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadItem } from "../hooks/useLeads";

interface DeleteModalProps {
  isOpen: boolean;
  item: LeadItem | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error: string | null;
}

export function DeleteLeadsConfirmModal({ isOpen, item, onClose, onConfirm, isDeleting, error }: DeleteModalProps) {
  const { t } = useI18n();

  return (
    <ConfirmActionModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmLeads.deleteTitle}
      description={error ?? t.crmLeads.deleteMessage(item?.leadName ?? "")}
      confirmLabel={isDeleting ? t.crmLeads.deleting : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isDeleting}
    />
  );
}
