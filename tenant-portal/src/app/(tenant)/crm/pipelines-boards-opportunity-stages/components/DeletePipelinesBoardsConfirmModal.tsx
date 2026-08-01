"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PipelineBoardItem } from "../hooks/usePipelinesBoards";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: PipelineBoardItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePipelinesBoardsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteSalesFunnel}
      message={`هل أنت تأكد من حذف مسار المبيعات "${item?.name || ""}"؟`}
      confirmText={t.crm.deletePath}
      isDanger
    />
  );
}
