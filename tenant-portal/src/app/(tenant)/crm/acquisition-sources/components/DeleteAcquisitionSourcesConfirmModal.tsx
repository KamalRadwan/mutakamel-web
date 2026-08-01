"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AcquisitionSourceItem } from "../hooks/useAcquisitionSources";

interface DeleteModalProps {
  isOpen: boolean;
  item: AcquisitionSourceItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAcquisitionSourcesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف مصدر الاستقطاب"
      message={`هل أنت تأكد من حذف مصدر الاستقطاب "${item?.name || ""}"؟`}
      confirmText="حذف المصدر"
      isDanger
    />
  );
}
