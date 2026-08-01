"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InvoiceItem } from "../hooks/useBillingInvoicesSubscription";

interface DeleteModalProps {
  isOpen: boolean;
  item: InvoiceItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteBillingInvoicesSubscriptionConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وإلغاء الفاتورة"
      message={`هل أنت تأكد من إلغاء وحذف الفاتورة رقم ${item?.invoiceNumber || ""} بمبلغ ${item?.amount || ""} ${item?.currency || ""}؟`}
      confirmText="إلغاء وحذف الفاتورة"
      isDanger
    />
  );
}
