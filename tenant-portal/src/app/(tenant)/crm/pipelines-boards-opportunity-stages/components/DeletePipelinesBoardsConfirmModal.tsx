"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PipelineBoardItem } from "../hooks/usePipelinesBoards";

interface DeleteModalProps {
  isOpen: boolean;
  item: PipelineBoardItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePipelinesBoardsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف مسار المبيعات"
      message={`هل أنت تأكد من حذف مسار المبيعات "${item?.name || ""}"؟`}
      confirmText="حذف المسار"
      isDanger
    />
  );
}
