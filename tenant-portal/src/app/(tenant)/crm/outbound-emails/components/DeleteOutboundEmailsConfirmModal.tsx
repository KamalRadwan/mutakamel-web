"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { OutboundEmailItem } from "../hooks/useOutboundEmails";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: OutboundEmailItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteOutboundEmailsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteAndBlockTheMessage}
      message={`هل أنت تأكد من إلغاء وحذف الرسالة الموجهة إلى "${item?.recipientEmail || ""}"؟`}
      confirmText={t.crm.deleteTheMessage}
      isDanger
    />
  );
}
