"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";

interface DeleteOpportunityDialogProps {
  item: OpportunityListItem | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error: string | null;
}

export function DeleteOpportunityDialog({ item, onClose, onConfirm, isDeleting, error }: DeleteOpportunityDialogProps) {
  const { t } = useI18n();

  return (
    <ConfirmActionModal
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmOpportunities.deleteTitle}
      description={error ?? t.crmOpportunities.deleteMessage(item?.title ?? "")}
      confirmLabel={isDeleting ? t.crmOpportunities.deleting : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isDeleting}
    />
  );
}
