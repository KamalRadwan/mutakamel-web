"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ImportWebhookItem } from "../hooks/useTradeImportsWebhooks";

interface DeleteModalProps {
  isOpen: boolean;
  item: ImportWebhookItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeImportsWebhooksConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف عملية الاستيراد أو Webhook"
      message={`هل أنت تأكد من إزالة الإجراء "${item?.name || ""}"؟`}
      confirmText="حذف الإجراء"
      isDanger
    />
  );
}
