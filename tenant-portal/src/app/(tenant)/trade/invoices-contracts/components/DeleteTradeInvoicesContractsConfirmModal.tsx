"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InvoiceContractItem } from "../hooks/useTradeInvoicesContracts";

interface DeleteModalProps {
  isOpen: boolean;
  item: InvoiceContractItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeInvoicesContractsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="إلغاء وحذف المستند التجاري"
      message={`هل أنت تأكد من إلغاء المستند "${item?.documentNumber || ""}" للعميل "${item?.customerName || ""}"؟`}
      confirmText="إلغاء المستند"
      isDanger
    />
  );
}
