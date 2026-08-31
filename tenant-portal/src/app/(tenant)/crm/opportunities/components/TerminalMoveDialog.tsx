"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityCardRecord, StageFlag } from "../hooks/pipeline-types";

interface TerminalMoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: OpportunityCardRecord | null;
  targetFlag: StageFlag;
  onConfirm: (reason: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

// Non-alert Dialog rather than ConfirmActionModal — this confirmation needs
// a reason field, which ConfirmActionModal has no slot for. Escape/backdrop
// stay blocked while submitting, matching ConfirmActionModal's guard.
export function TerminalMoveDialog({
  isOpen,
  onClose,
  opportunity,
  targetFlag,
  onConfirm,
  isSubmitting,
  error,
}: TerminalMoveDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const isWon = targetFlag === "WON";

  function close() {
    if (isSubmitting) return;
    setReason("");
    onClose();
  }

  async function handleConfirm() {
    if (await onConfirm(reason)) setReason("");
  }

  if (!opportunity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={!isSubmitting}
        onEscapeKeyDown={(event) => (isSubmitting ? event.preventDefault() : undefined)}
        onPointerDownOutside={(event) => (isSubmitting ? event.preventDefault() : undefined)}
      >
        <DialogHeader>
          <DialogTitle>{isWon ? t.crmOpportunities.wonTitle : t.crmOpportunities.lostTitle}</DialogTitle>
          <DialogDescription>
            {isWon ? t.crmOpportunities.wonDescription(opportunity.title) : t.crmOpportunities.lostDescription(opportunity.title)}
          </DialogDescription>
        </DialogHeader>

        <Field label={isWon ? t.crmOpportunities.notesOptional : t.crmOpportunities.reasonRequired}>
          <Textarea
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            placeholder={isWon ? t.crmOpportunities.notesPlaceholder : t.crmOpportunities.reasonPlaceholder}
            disabled={isSubmitting}
          />
        </Field>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isSubmitting}>
            {t.common.cancel}
          </Button>
          <Button
            variant={isWon ? "primary" : "destructive"}
            onClick={() => void handleConfirm()}
            loading={isSubmitting}
            disabled={!isWon && reason.trim() === ""}
          >
            {isWon ? t.crmOpportunities.confirmWon : t.crmOpportunities.confirmLost}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
