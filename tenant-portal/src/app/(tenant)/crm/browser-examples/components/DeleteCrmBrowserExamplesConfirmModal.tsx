"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BrowserExampleItem } from "../hooks/useCrmBrowserExamples";

interface DeleteModalProps {
  isOpen: boolean;
  item: BrowserExampleItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmBrowserExamplesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف نموذج الاستدعاء"
      message={`هل أنت تأكد من حذف نموذج المتصفح "${item?.name || ""}"؟`}
      confirmText="حذف النموذج"
      isDanger
    />
  );
}
