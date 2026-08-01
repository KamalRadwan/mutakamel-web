"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CommercialAccountItem } from "../hooks/useCommercialAccountsCredit";

interface DeleteModalProps {
  isOpen: boolean;
  item: CommercialAccountItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCommercialAccountsCreditConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الحساب التجاري"
      message={`هل أنت تأكد من إزالة الحساب التجاري "${item?.accountName || ""}" (${item?.accountNumber || ""})؟`}
      confirmText="حذف الحساب"
      isDanger
    />
  );
}
