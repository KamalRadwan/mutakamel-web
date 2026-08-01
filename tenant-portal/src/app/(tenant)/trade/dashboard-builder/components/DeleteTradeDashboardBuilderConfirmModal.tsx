"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { TradeDashboardItem } from "../hooks/useTradeDashboardBuilder";

interface DeleteModalProps {
  isOpen: boolean;
  item: TradeDashboardItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeDashboardBuilderConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف اللوحة التجارية"
      message={`هل أنت تأكد من حذف اللوحة التجارية "${item?.name || ""}"؟`}
      confirmText="حذف اللوحة"
      isDanger
    />
  );
}
