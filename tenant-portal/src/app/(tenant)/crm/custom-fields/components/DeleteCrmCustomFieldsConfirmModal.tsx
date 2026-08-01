"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CustomFieldItem } from "../hooks/useCrmCustomFields";

interface DeleteModalProps {
  isOpen: boolean;
  item: CustomFieldItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmCustomFieldsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الحقل المخصص"
      message={`هل أنت تأكد من حذف الحقل المخصص "${item?.label || ""}" (${item?.key || ""})؟`}
      confirmText="حذف الحقل"
      isDanger
    />
  );
}
