"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CurrencyItem } from "../hooks/useCurrenciesTaxesNumbering";

interface DeleteModalProps {
  isOpen: boolean;
  item: CurrencyItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCurrenciesTaxesNumberingConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف العملة"
      message={`هل أنت تأكد من حذف العملة ${item?.name || ""} (${item?.code || ""})؟`}
      confirmText="حذف العملة"
      isDanger
    />
  );
}
