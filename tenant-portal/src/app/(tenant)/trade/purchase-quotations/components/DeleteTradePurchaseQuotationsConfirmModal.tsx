"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PurchaseQuotationItem } from "../hooks/useTradePurchaseQuotations";

interface DeleteModalProps {
  isOpen: boolean;
  item: PurchaseQuotationItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradePurchaseQuotationsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف عرض سعر المورد"
      message={`هل أنت تأكد من استبعاد وعرض السعر "${item?.rfqNumber || ""}" المقدم من "${item?.supplierName || ""}"؟`}
      confirmText="استبعاد العرض"
      isDanger
    />
  );
}
