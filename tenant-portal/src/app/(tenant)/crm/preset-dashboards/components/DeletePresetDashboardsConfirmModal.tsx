"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PresetDashboardItem } from "../hooks/usePresetDashboards";

interface DeleteModalProps {
  isOpen: boolean;
  item: PresetDashboardItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePresetDashboardsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف اللوحة المسبقة"
      message={`هل أنت تأكد من حذف اللوحة المسبقة "${item?.name || ""}"؟`}
      confirmText="حذف اللوحة"
      isDanger
    />
  );
}
