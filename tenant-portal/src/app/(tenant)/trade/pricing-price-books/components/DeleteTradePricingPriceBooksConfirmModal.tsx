"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PriceBookItem } from "../hooks/useTradePricingPriceBooks";

interface DeleteModalProps {
  isOpen: boolean;
  item: PriceBookItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradePricingPriceBooksConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف كتاب قوائم الأسعار"
      message={`هل أنت تأكد من إزالة قائمة الأسعار "${item?.bookName || ""}"؟`}
      confirmText="حذف القائمة"
      isDanger
    />
  );
}
