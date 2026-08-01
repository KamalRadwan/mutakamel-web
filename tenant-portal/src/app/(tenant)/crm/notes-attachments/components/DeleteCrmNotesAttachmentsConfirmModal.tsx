"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NoteAttachmentItem } from "../hooks/useCrmNotesAttachments";

interface DeleteModalProps {
  isOpen: boolean;
  item: NoteAttachmentItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmNotesAttachmentsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الملاحظة والمرفق"
      message={`هل أنت تأكد من حذف الملاحظة "${item?.title || ""}" والمرفق المقترن "${item?.attachmentName || ""}"؟`}
      confirmText="حذف الملاحظة والمرفق"
      isDanger
    />
  );
}
