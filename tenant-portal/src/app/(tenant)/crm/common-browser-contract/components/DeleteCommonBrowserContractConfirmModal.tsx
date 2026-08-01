"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BrowserContractRuleItem } from "../hooks/useCommonBrowserContract";

interface DeleteModalProps {
  isOpen: boolean;
  item: BrowserContractRuleItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCommonBrowserContractConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف قاعدة العقد"
      message={`هل أنت تأكد من حذف القاعدة "${item?.ruleName || ""}"؟`}
      confirmText="حذف القاعدة"
      isDanger
    />
  );
}
