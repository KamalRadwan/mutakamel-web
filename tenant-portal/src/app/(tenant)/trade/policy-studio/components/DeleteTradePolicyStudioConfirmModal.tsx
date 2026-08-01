"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PolicyRuleItem } from "../hooks/useTradePolicyStudio";

interface DeleteModalProps {
  isOpen: boolean;
  item: PolicyRuleItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradePolicyStudioConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف سياسة وقاعدة الأعمال"
      message={`هل أنت تأكد من إزالة السياسة "${item?.policyName || ""}"؟`}
      confirmText="حذف السياسة"
      isDanger
    />
  );
}
