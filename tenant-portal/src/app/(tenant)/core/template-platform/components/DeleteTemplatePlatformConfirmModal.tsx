"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { TemplateItem } from "../hooks/useTemplatePlatform";

interface DeleteModalProps {
  isOpen: boolean;
  item: TemplateItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTemplatePlatformConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف القالب"
      message={`هل أنت تأكد من حذف القالب "${item?.name || ""}"؟`}
      confirmText="حذف القالب"
      isDanger
    />
  );
}
