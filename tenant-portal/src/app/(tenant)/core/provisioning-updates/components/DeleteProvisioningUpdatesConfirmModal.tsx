"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ProvisioningUpdateItem } from "../hooks/useProvisioningUpdates";

interface DeleteModalProps {
  isOpen: boolean;
  item: ProvisioningUpdateItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProvisioningUpdatesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وإلغاء تحديث النظام"
      message={`هل أنت تأكد من إلغاء جدولة التحديث ${item?.version || ""} للمكون ${item?.targetComponent || ""}؟`}
      confirmText="إلغاء التحديث"
      isDanger
    />
  );
}
