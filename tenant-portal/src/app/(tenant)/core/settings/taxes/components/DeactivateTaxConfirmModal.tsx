"use client";

import { AlertCircle, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  IdentifierText,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
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
  const { t, lang } = useI18n();
  const taxReference = tax ? `${tax.name} (${tax.code})` : "";
  const formattedRate = tax
    ? formatTemplate(t.coreSettings.taxRateValue, {
        rate: formatDecimalString(tax.rate, lang, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 4,
        }),
      })
    : "";

  return (
    <AlertDialog
      open={tax !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) onClose();
      }}
    >
      <AlertDialogContent aria-busy={isSubmitting || undefined} className="max-w-md gap-3.5 p-4">
        <div className="relative flex flex-col items-center gap-2 pt-1 text-center">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={t.common.close}
            disabled={isSubmitting}
            onClick={onClose}
            className="absolute end-0 top-0 px-1.5 text-muted-foreground"
          >
            <X className={iconSize({ size: "sm" })} aria-hidden="true" />
          </Button>
          <span
            aria-hidden="true"
            className="inline-flex size-10 items-center justify-center rounded-full bg-destructive-subtle text-destructive"
          >
            <AlertCircle className={iconSize({ size: "lg" })} />
          </span>
          <AlertDialogHeader className="items-center text-center">
            <AlertDialogTitle className="text-base">{t.coreSettings.taxDeactivateTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              {formatTemplate(t.coreSettings.taxDeactivateMessage, { code: taxReference })}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        {tax ? (
          <div className="grid grid-cols-3 gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-start">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-caption text-muted-foreground">{t.coreSettings.taxName}</span>
              <bdi className="truncate text-xs font-medium text-foreground">{tax.name}</bdi>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-caption text-muted-foreground">{t.coreSettings.taxCode}</span>
              <IdentifierText className="truncate text-xs">{tax.code}</IdentifierText>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-caption text-muted-foreground">{t.coreSettings.taxRate}</span>
              <span dir="ltr" className="text-xs font-medium tabular-nums text-foreground">
                {formattedRate}
              </span>
            </div>
          </div>
        ) : null}

        <AlertDialogFooter className="sm:grid sm:grid-cols-2 sm:justify-stretch">
          <AlertDialogCancel disabled={isSubmitting} className="w-full">
            {t.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting}
            className="w-full"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {t.coreSettings.deactivate}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
