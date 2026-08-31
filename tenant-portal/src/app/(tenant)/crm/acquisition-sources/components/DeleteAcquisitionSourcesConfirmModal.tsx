"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../acquisition-source-contract";

interface DeleteModalProps {
  isOpen: boolean;
  item: AcquisitionSource | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function DeleteAcquisitionSourcesConfirmModal({
  isOpen,
  item,
  onClose,
  onConfirm,
  isSubmitting,
  error,
}: DeleteModalProps) {
  const { t, lang } = useI18n();
  const name = localizedName(item, lang);
  const message = t.crmAcquisitionSources.deleteMessage(name);

  return (
    <ConfirmActionModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmAcquisitionSources.deleteTitle}
      description={error ? `${message} ${error}` : message}
      confirmLabel={isSubmitting ? t.crmAcquisitionSources.deleting : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isSubmitting}
    />
  );
}
