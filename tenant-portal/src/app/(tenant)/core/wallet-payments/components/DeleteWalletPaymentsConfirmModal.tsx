"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { TransactionItem } from "../hooks/useWalletPayments";

interface DeleteModalProps {
  isOpen: boolean;
  item: TransactionItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteWalletPaymentsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="إلغاء المعاملة المالية"
      message={`هل أنت تأكد من إلغاء وحذف حركة المحفظة رقم ${item?.txNumber || ""} بمبلغ ${item?.amount || ""} ${item?.currency || ""}؟`}
      confirmText="إلغاء الحركة"
      isDanger
    />
  );
}
