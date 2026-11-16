"use client";

import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
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
import type { EmailProbeOutcome } from "../hooks/useEmailConfigActions";

interface EmailSmtpProbeModalProps {
  open: boolean;
  pending: "save" | "verify" | "probe" | null;
  probeOutcome: EmailProbeOutcome | null;
  formError: string | null;
  onRetry: () => void;
  onBackToSmtp: () => void;
  onClose: () => void;
}

export function EmailSmtpProbeModal({
  open,
  pending,
  probeOutcome,
  formError,
  onRetry,
  onBackToSmtp,
  onClose,
}: EmailSmtpProbeModalProps) {
  const { t } = useI18n();
  const isChecking = pending === "probe";
  const isSucceeded = !isChecking && probeOutcome?.status === "succeeded";
  const failureMessage =
    probeOutcome?.status === "failed"
      ? probeOutcome.message
      : formError ?? t.coreSettings.emailProbeFailed;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isChecking) onClose();
      }}
    >
      <DialogContent
        size="sm"
        showCloseButton={!isChecking}
        closeLabel={t.common.close}
        aria-busy={isChecking || undefined}
        onEscapeKeyDown={(event) => {
          if (isChecking) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isChecking) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t.coreSettings.emailProbeModalTitle}</DialogTitle>
          <DialogDescription>{t.coreSettings.emailProbeScopeNote}</DialogDescription>
        </DialogHeader>

        {isChecking ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 p-3 text-xs"
          >
            <Loader2
              className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">
                {t.coreSettings.emailProbeCheckingTitle}
              </span>
              <span className="text-muted-foreground">
                {t.coreSettings.emailProbeCheckingDescription}
              </span>
            </div>
          </div>
        ) : isSucceeded ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-md border border-success/30 bg-success-subtle p-3 text-xs text-success-subtle-foreground"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t.coreSettings.emailProbeTitle}</span>
              <span>{probeOutcome.message}</span>
            </div>
          </div>
        ) : (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground wrap-anywhere"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t.coreSettings.emailProbeFailed}</span>
              <bdi>{failureMessage}</bdi>
            </div>
          </div>
        )}

        <DialogFooter>
          {isChecking ? (
            <Button type="button" variant="outline" size="sm" disabled>
              {t.common.close}
            </Button>
          ) : isSucceeded ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onBackToSmtp}>
                {t.coreSettings.emailProbeBackToSmtp}
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onClose}>
                {t.common.close}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onBackToSmtp}>
                {t.coreSettings.emailProbeBackToSmtp}
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onRetry}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {t.common.retry}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
