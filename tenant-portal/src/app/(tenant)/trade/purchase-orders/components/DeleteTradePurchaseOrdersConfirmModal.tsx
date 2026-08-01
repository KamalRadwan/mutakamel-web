"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PurchaseOrderItem } from "../hooks/useTradePurchaseOrders";

interface DeleteModalProps {
  isOpen: boolean;
  item: PurchaseOrderItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradePurchaseOrdersConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="إلغاء أمر الشراء"
      message={`هل أنت تأكد من إلغاء أمر الشراء رقم "${item?.poNumber || ""}" الموجه إلى "${item?.supplierName || ""}"؟`}
      confirmText="إلغاء أمر الشراء"
      isDanger
    />
  );
}
