"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatCurrencyLabel, type Currency } from "../currency-contract";
import type { BaseCurrencyStatus } from "../hooks/useBaseCurrency";

interface SetDefaultCurrencyConfirmModalProps {
  currency: Currency | null;
  baseCurrency: Currency | null;
  baseStatus: BaseCurrencyStatus;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

/**
 * Centered confirmation before `POST /api/tenant/core/v1/currencies/:id/set-default`.
 *
 * `CurrenciesService.rebaseExchangeRates` divides stored rates by the target
 * `exchangeRate` in one server transaction, so `exchangeRate` is units of the
 * row currency per `1` current base currency. Displays the exact stored
 * decimal string (`1 BASE = storedRate TARGET`) without floating-point money
 * arithmetic and without claiming historical documents are rewritten.
 */
export function SetDefaultCurrencyConfirmModal({
  currency,
  baseCurrency,
  baseStatus,
  onClose,
  onConfirm,
  isSubmitting,
}: SetDefaultCurrencyConfirmModalProps) {
  const { t } = useI18n();
  const targetLabel = currency ? formatCurrencyLabel(currency) : "";
  const description =
    currency && baseCurrency
      ? formatTemplate(t.coreSettings.currencySetDefaultConfirmChange, {
          current: formatCurrencyLabel(baseCurrency),
          target: targetLabel,
        })
      : currency
        ? formatTemplate(t.coreSettings.currencySetDefaultConfirmTargetOnly, {
            target: targetLabel,
          })
        : "";

  return (
    <Dialog
      open={currency !== null}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent
        size="md"
        showCloseButton={!isSubmitting}
        closeLabel={t.common.close}
        onEscapeKeyDown={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
      >
        <DialogHeader className="pe-10">
          <DialogTitle className="text-base font-semibold">
            {t.coreSettings.currencySetDefaultConfirmTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {currency ? (
          <div className="flex flex-col gap-2.5 text-xs">
            {baseStatus === "unknown" ? (
              <p className="text-muted-foreground">
                {t.coreSettings.currencySetDefaultConfirmBaseUnknown}
              </p>
            ) : null}

            <p className="text-muted-foreground">
              {formatTemplate(t.coreSettings.currencySetDefaultRebaseNote, {
                code: currency.code,
              })}
            </p>

            {currency.exchangeRate !== null ? (
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <span className="text-muted-foreground">
                  {t.coreSettings.currencyCurrentStoredRate}
                </span>
                {baseCurrency ? (
                  <p dir="ltr" className="font-mono text-xs tabular-nums text-foreground">
                    1 {baseCurrency.code} = {currency.exchangeRate} {currency.code}
                  </p>
                ) : (
                  <p dir="ltr" className="font-mono text-xs tabular-nums text-foreground">
                    {currency.exchangeRate} {currency.code}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {t.coreSettings.currencySetDefault}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
