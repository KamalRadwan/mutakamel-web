"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PdfRenderJobItem } from "../hooks/useTradePdfRenderJobs";

interface DeleteModalProps {
  isOpen: boolean;
  item: PdfRenderJobItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradePdfRenderJobsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="إلغاء وحذف مهمة الطباعة"
      message={`هل أنت تأكد من إزالة مهمة رندر PDF للمستند "${item?.referenceNumber || ""}"؟`}
      confirmText="إلغاء المهمة"
      isDanger
    />
  );
}
