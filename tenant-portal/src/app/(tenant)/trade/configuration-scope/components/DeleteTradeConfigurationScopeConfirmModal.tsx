"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ConfigScopeItem } from "../hooks/useTradeConfigurationScope";

interface DeleteModalProps {
  isOpen: boolean;
  item: ConfigScopeItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeConfigurationScopeConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف نطاق التهيئة"
      message={`هل أنت تأكد من حذف نطاق التهيئة "${item?.scopeName || ""}" (${item?.targetCode || ""})؟`}
      confirmText="حذف النطاق"
      isDanger
    />
  );
}
