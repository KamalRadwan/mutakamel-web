"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { OutboundEmailItem } from "../hooks/useOutboundEmails";

interface DeleteModalProps {
  isOpen: boolean;
  item: OutboundEmailItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteOutboundEmailsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وحظر الرسالة"
      message={`هل أنت تأكد من إلغاء وحذف الرسالة الموجهة إلى "${item?.recipientEmail || ""}"؟`}
      confirmText="حذف الرسالة"
      isDanger
    />
  );
}
