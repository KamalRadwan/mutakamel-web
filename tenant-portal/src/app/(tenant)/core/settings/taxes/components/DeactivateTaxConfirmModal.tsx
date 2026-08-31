"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { Tax } from "../tax-contract";

interface DeactivateTaxConfirmModalProps {
  tax: Tax | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

// `DELETE /taxes/:id` sets the row INACTIVE and returns 204 — posted documents
// must keep resolving their tax, so nothing is removed.
export function DeactivateTaxConfirmModal({
  tax,
  onClose,
  onConfirm,
  isSubmitting,
}: DeactivateTaxConfirmModalProps) {
  const { t } = useI18n();

  return (
    <ConfirmActionModal
      open={tax !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.coreSettings.taxDeactivateTitle}
      description={formatTemplate(t.coreSettings.taxDeactivateMessage, { code: tax?.code ?? "" })}
      confirmLabel={t.coreSettings.deactivate}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isSubmitting}
    />
  );
}
