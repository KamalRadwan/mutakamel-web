"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NotificationConfigItem } from "../hooks/useNotificationsEmailConfig";

interface DeleteModalProps {
  isOpen: boolean;
  item: NotificationConfigItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteNotificationsEmailConfigConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="إلغاء قناة الإشعارات"
      message={`هل أنت تأكد من حذف إعدادات القناة البريدية "${item?.channel || ""}" (${item?.senderEmail || ""})؟`}
      confirmText="حذف الإعدادات"
      isDanger
    />
  );
}
