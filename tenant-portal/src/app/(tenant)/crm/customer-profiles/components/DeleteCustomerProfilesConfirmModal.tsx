"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CustomerProfileItem } from "../hooks/useCustomerProfiles";

interface DeleteModalProps {
  isOpen: boolean;
  item: CustomerProfileItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCustomerProfilesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف ملف العميل"
      message={`هل أنت تأكد من حذف ملف العميل "${item?.name || ""}"؟`}
      confirmText="حذف العميل"
      isDanger
    />
  );
}
