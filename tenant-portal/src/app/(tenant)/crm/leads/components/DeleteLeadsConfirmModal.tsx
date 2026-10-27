"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadItem } from "../hooks/useLeads";

interface DeleteModalProps {
  isOpen: boolean;
  item: LeadItem | null;
  bulkCounts?: { eligible: number; selected: number; skipped: number };
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error: string | null;
}

export function DeleteLeadsConfirmModal({ isOpen, item, bulkCounts, onClose, onConfirm, isDeleting, error }: DeleteModalProps) {
  const { t } = useI18n();
  const description = bulkCounts
    ? t.crmLeads.bulkDeleteMessage(bulkCounts.eligible, bulkCounts.selected, bulkCounts.skipped)
    : t.crmLeads.deleteMessage(item?.leadName ?? "");
  const hasNoTargets = bulkCounts?.eligible === 0;

  return (
    <ConfirmActionModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={bulkCounts ? t.crmLeads.bulkDeleteTitle : t.crmLeads.deleteTitle}
      description={bulkCounts && error ? `${description} ${error}` : error ?? description}
      confirmLabel={isDeleting ? t.crmLeads.deleting : hasNoTargets ? t.common.close : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={hasNoTargets ? onClose : onConfirm}
      loading={isDeleting}
    />
  );
}
