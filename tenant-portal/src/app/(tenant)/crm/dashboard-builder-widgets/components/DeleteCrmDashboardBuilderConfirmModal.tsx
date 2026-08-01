"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { WidgetItem } from "../hooks/useCrmDashboardBuilder";

interface DeleteModalProps {
  isOpen: boolean;
  item: WidgetItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmDashboardBuilderConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وإخفاء الـ Widget"
      message={`هل أنت تأكد من إزالة الـ Widget "${item?.name || ""}" من لوحة المؤشرات؟`}
      confirmText="إزالة الـ Widget"
      isDanger
    />
  );
}
