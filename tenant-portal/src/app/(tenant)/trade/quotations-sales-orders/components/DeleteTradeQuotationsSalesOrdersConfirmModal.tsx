"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { QuotationSalesOrderItem } from "../hooks/useTradeQuotationsSalesOrders";

interface DeleteModalProps {
  isOpen: boolean;
  item: QuotationSalesOrderItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeQuotationsSalesOrdersConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف عرض السعر أو أمر البيع"
      message={`هل أنت تأكد من إلغاء وحذف "${item?.orderNumber || ""}" الموجه إلى "${item?.customerName || ""}"؟`}
      confirmText="حذف المستند"
      isDanger
    />
  );
}
