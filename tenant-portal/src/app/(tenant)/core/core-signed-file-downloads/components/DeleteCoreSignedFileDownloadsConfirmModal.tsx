"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SignedFileItem } from "../hooks/useCoreSignedFileDownloads";

interface DeleteModalProps {
  isOpen: boolean;
  item: SignedFileItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCoreSignedFileDownloadsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف رابط التحميل الموقع"
      message={`هل أنت تأكد من إلغاء وحذف رابط تحميل الملف ${item?.filename || ""}؟`}
      confirmText="إلغاء وتدمير الرابط"
      isDanger
    />
  );
}
