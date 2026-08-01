"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BrowserContractRuleItem } from "../hooks/useCommonBrowserContract";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: BrowserContractRuleItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCommonBrowserContractConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheContractRule}
      message={`هل أنت تأكد من حذف القاعدة "${item?.ruleName || ""}"؟`}
      confirmText={t.crm.deleteTheRule}
      isDanger
    />
  );
}
