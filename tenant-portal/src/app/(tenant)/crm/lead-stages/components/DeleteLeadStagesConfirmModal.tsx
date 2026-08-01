"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LeadStageItem } from "../hooks/useLeadStages";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: LeadStageItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadStagesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheSalesFunnelStage}
      message={`هل أنت تأكد من حذف المرحلة "${item?.name || ""}"؟`}
      confirmText={t.crm.deleteStage}
      isDanger
    />
  );
}
