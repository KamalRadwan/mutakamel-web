"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, CodeRef } from "@/design-system";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

interface BackupDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  children: ReactNode;
  isSubmitting?: boolean;
  confirmDisabled?: boolean;
  destructive?: boolean;
  error?: NormalizedApiError | null;
}

/** Generic confirm-with-content dialog reused across ~23 backup module actions. */
export function BackupDialog({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  children,
  isSubmitting = false,
  confirmDisabled = false,
  destructive = false,
  error,
}: BackupDialogProps) {
  const { dir, t } = useI18n();
  const errorRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open && error) errorRef.current?.focus();
  }, [error, open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent
        dir={dir}
        showCloseButton={!isSubmitting}
        onOpenAutoFocus={(event) => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          if (!error) return;
          event.preventDefault();
          errorRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          const returnTarget = returnFocusRef.current;
          if (!returnTarget?.isConnected) return;
          event.preventDefault();
          returnTarget.focus();
          returnFocusRef.current = null;
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p>{error.message}</p>
              {(error.errorCode || error.correlationId) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {error.errorCode && <CodeRef value={error.errorCode} />}
                  {error.correlationId && <CodeRef value={error.correlationId} />}
                </div>
              )}
            </div>
          )}
          {children}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t.common.cancel}
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "primary"} onClick={onConfirm} disabled={isSubmitting || confirmDisabled} loading={isSubmitting}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
