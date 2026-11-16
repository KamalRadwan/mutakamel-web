"use client";

import { AlertTriangle, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SWATCH_SURFACE_PALETTES,
  cn,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatTemplate } from "@/lib/format/template";
import type { ApplyModalPhase } from "../hooks/apply-updates-state";
import type { TenantAvailableUpdate } from "../provisioning-updates-contract";
import { ApplySnapshotList } from "./ApplySnapshotList";

interface ApplyUpdatesModalProps {
  t: Dictionary;
  lang: Language;
  open: boolean;
  phase: ApplyModalPhase;
  snapshotItems: readonly TenantAvailableUpdate[];
  liveItems: readonly TenantAvailableUpdate[];
  staleConflictMessage: string | null;
  isConsented: boolean;
  canConfirm: boolean;
  canRetryAmbiguous: boolean;
  isApplying: boolean;
  onOpenChange: (open: boolean) => void;
  onConsentChange: (checked: boolean) => void;
  onConfirm: () => void;
  onReloadFromStale: () => void;
  onRetryAmbiguous: () => void;
}

export function ApplyUpdatesModal({
  t,
  lang,
  open,
  phase,
  snapshotItems,
  liveItems,
  staleConflictMessage,
  isConsented,
  canConfirm,
  canRetryAmbiguous,
  isApplying,
  onOpenChange,
  onConsentChange,
  onConfirm,
  onReloadFromStale,
  onRetryAmbiguous,
}: ApplyUpdatesModalProps) {
  const updatesUi = t.coreSettings.updatesUi;
  const formattedCount = new Intl.NumberFormat(INTL_LOCALE[lang]).format(snapshotItems.length);
  const hasBackupOrMaintenance = snapshotItems.some(
    (item) => item.availableRelease.requiresBackup || item.availableRelease.requiresMaintenance,
  );
  const isCautionPhase = phase === "stale" || phase === "ambiguous";
  const headerTitle =
    phase === "stale"
      ? updatesUi.staleModalTitle
      : phase === "ambiguous"
        ? updatesUi.ambiguousTitle
        : updatesUi.modalTitle;
  const headerDescription =
    phase === "stale"
      ? (staleConflictMessage ?? updatesUi.staleModalDescription)
      : phase === "ambiguous"
        ? updatesUi.ambiguousDescription
        : updatesUi.modalDescription;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isApplying) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        size="lg"
        showCloseButton={!isApplying}
        aria-busy={isApplying || undefined}
        onEscapeKeyDown={(event) => {
          if (isApplying) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isApplying) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isApplying) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-2.5 pe-10">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md border",
                isCautionPhase
                  ? SWATCH_SURFACE_PALETTES.amber.iconBoxIdle
                  : SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
              )}
            >
              {isCautionPhase ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : (
                <PackageCheck className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-base">{headerTitle}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {headerDescription}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {snapshotItems.length > 0 ? (
          <ApplySnapshotList
            t={t}
            mode={phase}
            snapshotItems={snapshotItems}
            liveItems={liveItems}
          />
        ) : null}

        {phase === "confirm" && hasBackupOrMaintenance ? (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{updatesUi.modalRequirementsWarning}</span>
          </div>
        ) : null}

        {phase === "confirm" ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-card p-2.5 text-xs text-foreground">
            <Checkbox
              checked={isConsented}
              disabled={isApplying}
              onCheckedChange={(checked) => onConsentChange(checked === true)}
              className="mt-0.5"
            />
            <span className="leading-relaxed">{updatesUi.modalConsentLabel}</span>
          </label>
        ) : null}

        {phase === "ambiguous" ? (
          <p className="text-xs text-muted-foreground">{updatesUi.ambiguousRetryHint}</p>
        ) : null}

        {isApplying ? (
          <p className="text-xs text-muted-foreground">{updatesUi.modalSubmittingHint}</p>
        ) : null}

        <DialogFooter>
          {phase === "stale" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                {t.common.close}
              </Button>
              <Button size="sm" variant="primary" onClick={onReloadFromStale}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {updatesUi.staleModalReloadCta}
              </Button>
            </>
          ) : phase === "ambiguous" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isApplying}
              >
                {t.common.close}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={onRetryAmbiguous}
                loading={isApplying}
                disabled={!canRetryAmbiguous || isApplying}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {updatesUi.ambiguousRetryCta}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isApplying}
              >
                {t.common.cancel}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={onConfirm}
                loading={isApplying}
                disabled={!canConfirm || !isConsented || snapshotItems.length === 0 || isApplying}
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                {formatTemplate(updatesUi.modalConfirmCta, { count: formattedCount })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
