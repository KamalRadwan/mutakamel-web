"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { OpportunityItem } from "../hooks/useOpportunitiesStageHistory";

interface DeleteModalProps {
  isOpen: boolean;
  item: OpportunityItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteOpportunitiesStageHistoryConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الفرصة التجارية"
      message={`هل أنت تأكد من حذف الفرصة التجارية "${item?.title || ""}" بقيمة ${item?.amount || ""} ${item?.currency || ""}؟`}
      confirmText="حذف الفرصة"
      isDanger
    />
  );
}
