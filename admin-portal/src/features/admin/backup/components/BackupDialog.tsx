"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from "@/design-system";

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
}: BackupDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">{children}</div>

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
