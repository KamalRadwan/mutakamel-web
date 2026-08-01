"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NoteAttachmentItem } from "../hooks/useCrmNotesAttachments";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: NoteAttachmentItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmNotesAttachmentsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheNoteAndAttachment}
      message={`هل أنت تأكد من حذف الملاحظة "${item?.title || ""}" والمرفق المقترن "${item?.attachmentName || ""}"؟`}
      confirmText={t.crm.deleteTheNoteAndAttachment}
      isDanger
    />
  );
}
