"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { TradeAiGuideItem } from "../hooks/useTradeAiGuide";

interface DeleteModalProps {
  isOpen: boolean;
  item: TradeAiGuideItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeAiGuideConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف دليل الذكاء الاصطناعي"
      message={`هل أنت تأكد من حذف الدليل "${item?.guideTitle || ""}"؟`}
      confirmText="حذف الدليل"
      isDanger
    />
  );
}
