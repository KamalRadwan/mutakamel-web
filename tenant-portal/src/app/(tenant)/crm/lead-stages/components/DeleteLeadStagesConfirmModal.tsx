"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LeadStageItem } from "../hooks/useLeadStages";

interface DeleteModalProps {
  isOpen: boolean;
  item: LeadStageItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadStagesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف مرحلة قمع المبيعات"
      message={`هل أنت تأكد من حذف المرحلة "${item?.name || ""}"؟`}
      confirmText="حذف المرحلة"
      isDanger
    />
  );
}
