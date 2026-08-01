"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { OpportunityItem } from "../hooks/useOpportunitiesStageHistory";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: OpportunityItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteOpportunitiesStageHistoryConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteBusinessOpportunity}
      message={`هل أنت تأكد من حذف الفرصة التجارية "${item?.title || ""}" بقيمة ${item?.amount || ""} ${item?.currency || ""}؟`}
      confirmText={t.crm.deleteOpportunity}
      isDanger
    />
  );
}
