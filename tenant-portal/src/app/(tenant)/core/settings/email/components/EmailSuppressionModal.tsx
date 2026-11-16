"use client";

import { AlertCircle, CheckCircle2, Info, Loader2, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IdentifierText,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { EmailSuppressionLookup } from "../email-suppression-contract";
import type { EmailSuppressionNoticeKind } from "../hooks/useEmailSuppression";

interface EmailSuppressionModalProps {
  copy: Dictionary["emailSuppression"];
  closeLabel: string;
  retryLabel: string;
  address: string;
  result: EmailSuppressionLookup | null;
  pending: boolean;
  confirming: boolean;
  isLookupModalOpen: boolean;
  error: string | undefined;
  notice: string | null;
  noticeKind: EmailSuppressionNoticeKind | null;
  formatDate: (value: string) => string;
  onCloseLookup: () => void;
  onSetConfirming: (next: boolean) => void;
  onRetryLookup: () => void;
  onConfirmLift: () => void;
}

export function EmailSuppressionModal({
  copy,
  closeLabel,
  retryLabel,
  address,
  result,
  pending,
  confirming,
  isLookupModalOpen,
  error,
  notice,
  noticeKind,
  formatDate,
  onCloseLookup,
  onSetConfirming,
  onRetryLookup,
  onConfirmLift,
}: EmailSuppressionModalProps) {
  const trimmedAddress = address.trim();
  const isLookupOpen = isLookupModalOpen && !confirming;
  const isSuppressed = !pending && !notice && result?.suppressed === true;
  const isNotSuppressed = !pending && !notice && result?.suppressed === false;

  return (
    <>
      <Dialog
        open={isLookupOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !pending) onCloseLookup();
        }}
      >
        <DialogContent
          size="md"
          showCloseButton={!pending}
          closeLabel={closeLabel}
          aria-describedby={undefined}
          aria-busy={pending || undefined}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.lookupModalTitle}</DialogTitle>
          </DialogHeader>

          {trimmedAddress ? (
            <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">{copy.address}</span>
              <IdentifierText className="text-xs font-medium text-foreground">
                {trimmedAddress}
              </IdentifierText>
            </div>
          ) : null}

          {pending ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2.5 rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground"
            >
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
              <span>{copy.working}</span>
            </div>
          ) : notice ? (
            <div
              role="status"
              aria-live="polite"
              className={
                noticeKind === "lifted"
                  ? "flex items-start gap-2.5 rounded-md border border-success/30 bg-success-subtle p-3 text-xs text-success-subtle-foreground"
                  : "flex items-start gap-2.5 rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground"
              }
            >
              {noticeKind === "lifted" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="font-medium">{notice}</span>
            </div>
          ) : result?.suppressed === true ? (
            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="caution" size="sm">
                  {copy.suppressed}
                </Badge>
              </div>
              <dl className="grid gap-3 text-xs sm:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">{copy.reason}</dt>
                  <dd className="font-medium text-foreground">{copy.reasons[result.reasonCode]}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">{copy.firstOccurred}</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatDate(result.firstOccurredAt)}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">{copy.lastOccurred}</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatDate(result.lastOccurredAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : isNotSuppressed ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-md border border-success/30 bg-success-subtle p-3 text-xs text-success-subtle-foreground"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="font-medium">{copy.notSuppressed}</span>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter>
            {isSuppressed ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onCloseLookup}>
                  {closeLabel}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onSetConfirming(true)}
                >
                  {copy.lift}
                </Button>
              </>
            ) : error && !pending ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onCloseLookup}>
                  {closeLabel}
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={onRetryLookup}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {retryLabel}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant={pending ? "outline" : "primary"}
                size="sm"
                disabled={pending}
                onClick={onCloseLookup}
              >
                {closeLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirming}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !pending) onSetConfirming(false);
        }}
      >
        <DialogContent
          size="sm"
          showCloseButton={!pending}
          closeLabel={closeLabel}
          aria-busy={pending || undefined}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.confirmTitle}</DialogTitle>
            <DialogDescription>{copy.confirmDescription}</DialogDescription>
          </DialogHeader>

          {trimmedAddress ? (
            <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">{copy.address}</span>
              <IdentifierText className="text-xs font-medium text-foreground">
                {trimmedAddress}
              </IdentifierText>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onSetConfirming(false)}
            >
              {copy.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              loading={pending}
              disabled={pending}
              onClick={onConfirmLift}
            >
              {copy.lift}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
