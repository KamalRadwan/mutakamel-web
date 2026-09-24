"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CrmTagCatalogueItem } from "../../shared/tag-contract";

interface DeleteCrmTagConfirmModalProps {
  tag: CrmTagCatalogueItem | null;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmTagConfirmModal({ tag, error, isSubmitting, onClose, onConfirm }: DeleteCrmTagConfirmModalProps) {
  const { t } = useI18n();
  const message = formatTemplate(t.crmTags.deleteMessage, { name: tag?.name ?? "" });

  return (
    <ConfirmActionModal
      open={tag !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmTags.deleteTitle}
      description={error ? `${message} ${error}` : message}
      confirmLabel={isSubmitting ? t.crmTags.deleting : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isSubmitting}
    />
  );
}
