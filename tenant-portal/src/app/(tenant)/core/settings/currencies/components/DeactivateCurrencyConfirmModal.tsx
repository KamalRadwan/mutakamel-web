"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatCurrencyLabel, type Currency } from "../currency-contract";

interface DeactivateCurrencyConfirmModalProps {
  currency: Currency | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

// `DELETE /currencies/:id` marks the row INACTIVE and returns 204 — history is
// preserved, so the control never says "delete".
export function DeactivateCurrencyConfirmModal({
  currency,
  onClose,
  onConfirm,
  isSubmitting,
}: DeactivateCurrencyConfirmModalProps) {
  const { t } = useI18n();
  const currencyLabel = currency ? formatCurrencyLabel(currency) : "";

  return (
    <ConfirmActionModal
      open={currency !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        currencyLabel
          ? `${t.coreSettings.currencyDeactivateTitle} — ${currencyLabel}`
          : t.coreSettings.currencyDeactivateTitle
      }
      description={formatTemplate(t.coreSettings.currencyDeactivateMessage, {
        code: currencyLabel,
      })}
      confirmLabel={t.coreSettings.deactivate}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isSubmitting}
    />
  );
}
