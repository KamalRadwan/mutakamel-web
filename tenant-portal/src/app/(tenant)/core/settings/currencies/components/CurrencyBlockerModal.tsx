"use client";

import { AlertCircle } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IdentifierText,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CurrencyActionBlocker } from "../hooks/currency-errors";

interface CurrencyBlockerModalProps {
  blocker: CurrencyActionBlocker | null;
  onClose: () => void;
}

/**
 * Surfaces server-authoritative domain blockers (`CURRENCY_DEFAULT_DELETE`,
 * `CURRENCY_IN_USE`, `CURRENCY_COMPANY_IN_USE`, `CURRENCY_INACTIVE_DEFAULT`,
 * rebase range/precision rejections) in a concise centered dialog naming the
 * affected currency row and safe localized guidance.
 */
export function CurrencyBlockerModal({ blocker, onClose }: CurrencyBlockerModalProps) {
  const { t } = useI18n();
  const title =
    blocker?.kind === "setDefault"
      ? t.coreSettings.currencySetDefaultBlockedTitle
      : blocker?.kind === "reactivate"
        ? t.coreSettings.currencyReactivateBlockedTitle
        : t.coreSettings.currencyDeactivateBlockedTitle;

  return (
    <Dialog
      open={blocker !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="sm" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
            </span>
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {blocker?.reason ?? ""}
          </DialogDescription>
        </DialogHeader>

        {blocker ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t.coreSettings.currencyRecordLabel}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-end">
              <bdi className="truncate font-medium text-foreground">{blocker.currency.name}</bdi>
              <IdentifierText className="font-medium text-foreground">
                {blocker.currency.code}
              </IdentifierText>
            </span>
          </div>
        ) : null}

        <DialogFooter className="border-t border-border pt-3">
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
