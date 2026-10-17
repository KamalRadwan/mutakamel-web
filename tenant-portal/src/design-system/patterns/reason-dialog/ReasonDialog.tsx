"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../primitives/Dialog";
import { Field } from "../../primitives/Field";
import { Textarea } from "../../primitives/Textarea";

export interface ReasonDialogLabels {
  reason: string;
  reasonPlaceholder?: string;
  reasonHint?: string;
  confirm: string;
  cancel: string;
}

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Optional icon badge rendered beside the dialog title. */
  headerIcon?: ReactNode;
  /** Optional summary card rendered above the reason field. */
  summarySlot?: ReactNode;
  /** Optional quick-reason template pills rendered above the textarea. */
  templatesLabel?: string;
  templates?: readonly string[];
  /** Whether to show the visible label above the textarea. */
  showLabel?: boolean;
  /** When true the confirm stays disabled until a non-blank reason is typed. */
  reasonRequired?: boolean;
  /** Mirrors the backend column bound — pass the real one, do not accept the default blindly. */
  maxLength?: number;
  /** Styles confirm as destructive. The caller decides; the pattern does not guess from the title. */
  destructive?: boolean;
  /** Optional footer note rendered at the inline start of the footer bar. */
  footerLeading?: ReactNode;
  /** Optional icon rendered inside the confirm button. */
  confirmIcon?: ReactNode;
  /** Optional class override for the confirm button. */
  confirmClassName?: string;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  /** A rejection that is not field-level — rendered in-body, never as a toast. */
  error?: string;
  labels: ReasonDialogLabels;
}

const DEFAULT_MAX_LENGTH = 1000;

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  headerIcon,
  summarySlot,
  templatesLabel,
  templates,
  showLabel = false,
  reasonRequired = false,
  maxLength = DEFAULT_MAX_LENGTH,
  destructive = false,
  footerLeading,
  confirmIcon,
  confirmClassName,
  onConfirm,
  loading,
  error,
  labels,
}: ReasonDialogProps) {
  function dismiss() {
    if (loading) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : dismiss())}>
      <DialogContent
        className="p-4 sm:p-5"
        showCloseButton={!loading}
        aria-busy={loading || undefined}
        onEscapeKeyDown={(event) => (loading ? event.preventDefault() : undefined)}
        onPointerDownOutside={(event) => (loading ? event.preventDefault() : undefined)}
      >
        <ReasonDialogBody
          title={title}
          description={description}
          headerIcon={headerIcon}
          summarySlot={summarySlot}
          templatesLabel={templatesLabel}
          templates={templates}
          showLabel={showLabel}
          reasonRequired={reasonRequired}
          maxLength={maxLength}
          destructive={destructive}
          footerLeading={footerLeading}
          confirmIcon={confirmIcon}
          confirmClassName={confirmClassName}
          onConfirm={onConfirm}
          onDismiss={dismiss}
          loading={loading}
          error={error}
          labels={labels}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ReasonDialogBodyProps
  extends Omit<ReasonDialogProps, "open" | "onOpenChange" | "reasonRequired" | "maxLength" | "destructive"> {
  reasonRequired: boolean;
  maxLength: number;
  destructive: boolean;
  onDismiss: () => void;
}

function ReasonDialogBody({
  title,
  description,
  headerIcon,
  summarySlot,
  templatesLabel,
  templates,
  showLabel,
  reasonRequired,
  maxLength,
  destructive,
  footerLeading,
  confirmIcon,
  confirmClassName,
  onConfirm,
  onDismiss,
  loading,
  error,
  labels,
}: ReasonDialogBodyProps) {
  const [reason, setReason] = useState("");
  const blank = reason.trim() === "";

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          {headerIcon && <div className="shrink-0">{headerIcon}</div>}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
        </div>
      </DialogHeader>

      {summarySlot}

      {templates && templates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {templatesLabel && (
            <span className="text-xs font-semibold text-muted-foreground">{templatesLabel}</span>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {templates.map((template) => {
              const active = reason.trim() === template;
              return (
                <Button
                  key={template}
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={loading}
                  onClick={() => setReason(template)}
                  className={cn(
                    "h-auto rounded-full px-2.5 py-1 text-xs font-medium whitespace-normal text-start",
                    active &&
                      (destructive
                        ? "border-destructive bg-destructive text-primary-foreground hover:bg-destructive/90"
                        : "border-success bg-success text-primary-foreground hover:bg-success/90"),
                  )}
                >
                  {template}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <Field label={labels.reason} hint={labels.reasonHint} required={reasonRequired} showLabel={showLabel}>
        <Textarea
          value={reason}
          maxLength={maxLength}
          onChange={(event) => setReason(event.target.value)}
          placeholder={labels.reasonPlaceholder}
          disabled={loading}
          rows={3}
        />
      </Field>

      {/* Digits and a separator only — nothing here needs a dictionary key,
          and Arabic renders Western digits by settled decision. */}
      <p className="text-xs tabular-nums text-muted-foreground text-end" aria-hidden="true">
        {reason.length}/{maxLength}
      </p>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <DialogFooter className={cn(footerLeading && "sm:items-center sm:justify-between border-t border-border pt-3")}>
        {footerLeading && <div className="text-xs text-muted-foreground">{footerLeading}</div>}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={loading}>
            {labels.cancel}
          </Button>
          <Button
            size="sm"
            variant={destructive ? "destructive" : "primary"}
            className={confirmClassName}
            onClick={() => onConfirm(reason)}
            loading={loading}
            disabled={reasonRequired && blank}
          >
            {confirmIcon}
            {labels.confirm}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

