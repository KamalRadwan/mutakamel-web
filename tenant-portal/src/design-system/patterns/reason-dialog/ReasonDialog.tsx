"use client";

import { useState } from "react";
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
  /** When true the confirm stays disabled until a non-blank reason is typed. */
  reasonRequired?: boolean;
  /** Mirrors the backend column bound — pass the real one, do not accept the default blindly. */
  maxLength?: number;
  /** Styles confirm as destructive. The caller decides; the pattern does not guess from the title. */
  destructive?: boolean;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  /** A rejection that is not field-level — rendered in-body, never as a toast. */
  error?: string;
  labels: ReasonDialogLabels;
}

const DEFAULT_MAX_LENGTH = 1000;

// Promoted from the opportunities TerminalMoveDialog: a confirmation that has
// to collect a reason, which ConfirmActionModal has no slot for. A non-alert
// Dialog rather than AlertDialog for the same reason — AlertDialog is a
// two-button destructive confirm and cannot host an input.
//
// Escape, backdrop and the close button stay blocked while submitting,
// matching ConfirmActionModal's guard.
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonRequired = false,
  maxLength = DEFAULT_MAX_LENGTH,
  destructive = false,
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
        showCloseButton={!loading}
        aria-busy={loading || undefined}
        onEscapeKeyDown={(event) => (loading ? event.preventDefault() : undefined)}
        onPointerDownOutside={(event) => (loading ? event.preventDefault() : undefined)}
      >
        {/* The typed reason lives in the body, which Radix unmounts with the
            portal on close. A reopened dialog therefore starts empty by
            construction — no reset effect, and no path (parent-driven close,
            Escape, success) that can leave the previous attempt's text
            attached to a different action. */}
        <ReasonDialogBody
          title={title}
          description={description}
          reasonRequired={reasonRequired}
          maxLength={maxLength}
          destructive={destructive}
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
  reasonRequired,
  maxLength,
  destructive,
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
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      <Field label={labels.reason} hint={labels.reasonHint} required={reasonRequired}>
        <Textarea
          value={reason}
          maxLength={maxLength}
          onChange={(event) => setReason(event.target.value)}
          placeholder={labels.reasonPlaceholder}
          disabled={loading}
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

      <DialogFooter>
        <Button variant="outline" onClick={onDismiss} disabled={loading}>
          {labels.cancel}
        </Button>
        <Button
          variant={destructive ? "destructive" : "primary"}
          onClick={() => onConfirm(reason)}
          loading={loading}
          disabled={reasonRequired && blank}
        >
          {labels.confirm}
        </Button>
      </DialogFooter>
    </>
  );
}
