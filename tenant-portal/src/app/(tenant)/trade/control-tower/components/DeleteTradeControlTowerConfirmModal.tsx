"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ControlTowerItem } from "../hooks/useTradeControlTower";

interface DeleteModalProps {
  isOpen: boolean;
  item: ControlTowerItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeControlTowerConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف مؤشر برج المراقبة"
      message={`هل أنت تأكد من إزالة المؤشر القيادي "${item?.metricName || ""}"؟`}
      confirmText="حذف المؤشر"
      isDanger
    />
  );
}
