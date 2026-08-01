"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InventoryStockItem } from "../hooks/useTradeInventory";

interface DeleteModalProps {
  isOpen: boolean;
  item: InventoryStockItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeInventoryConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف صنف المخزون"
      message={`هل أنت تأكد من إزالة صنف المخزون "${item?.productName || ""}" (SKU: ${item?.sku || ""})؟`}
      confirmText="حذف الصنف"
      isDanger
    />
  );
}
