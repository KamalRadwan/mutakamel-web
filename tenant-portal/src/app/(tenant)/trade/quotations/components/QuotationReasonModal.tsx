"use client";

import * as React from "react";
import { Ban, ShieldAlert } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  IdentifierText,
  Input,
  Textarea,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  TRADE_REASON_CODE_MAX_LENGTH,
  partyDisplayName,
} from "../../documents/trade-document-contract";
import { TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import type { TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  TRADE_EVIDENCE_REF_MAX_LENGTH,
  buildQuotationReasonPayload,
  type Quotation,
  type QuotationReasonPayload,
} from "../quotation-contract";

export interface QuotationReasonModalProps {
  open: boolean;
  action: "cancel" | "reject" | null;
  quotation: Quotation;
  write: TradeWriteState;
  pending: boolean;
  onClose: () => void;
  onConfirm: (action: "cancel" | "reject", payload: QuotationReasonPayload) => Promise<void>;
}

/**
 * Centered Governance Modal for `POST /quotations/:id/cancel` and `POST /quotations/:id/reject`.
 *
 * Supports both `DocumentReasonDto` properties:
 * - `reasonCode` (required, 1..80 chars) with quick-preset chips
 * - `evidenceRef` (optional, 1..240 chars) for audit evidence linkage
 */
export function QuotationReasonModal(props: QuotationReasonModalProps) {
  const { open, action, quotation } = props;
  if (!action) return null;
  return (
    <QuotationReasonModalInner
      key={`${quotation.id}:${action}:${open ? "open" : "closed"}`}
      {...props}
      action={action}
    />
  );
}

function QuotationReasonModalInner({
  open,
  action,
  quotation,
  write,
  pending,
  onClose,
  onConfirm,
}: Omit<QuotationReasonModalProps, "action"> & { action: "cancel" | "reject" }) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const qCopy = td.quotations;

  const [reasonCode, setReasonCode] = React.useState("");
  const [evidenceRef, setEvidenceRef] = React.useState("");

  const presets = [
    qCopy.reasonPresetCustomerRequested,
    qCopy.reasonPresetSuperseded,
    qCopy.reasonPresetPricingRevised,
    qCopy.reasonPresetCompetitor,
    qCopy.reasonPresetBudgetHold,
  ];

  const title = action === "reject" ? qCopy.rejectTitle : qCopy.cancelTitle;
  const confirmLabel = action === "reject" ? qCopy.reject : qCopy.cancel;
  const trimmedReason = reasonCode.trim();
  const canConfirm = trimmedReason.length > 0 && !pending && !write.isBlocked;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canConfirm) return;
    const payload = buildQuotationReasonPayload(reasonCode, evidenceRef);
    void onConfirm(action, payload);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !pending ? onClose() : undefined)}>
      <DialogContent
        size="lg"
        className="p-4 sm:p-5"
        showCloseButton={!pending}
        aria-busy={pending || undefined}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-start gap-3 pe-8">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive-subtle text-destructive"
              >
                {action === "reject" ? (
                  <ShieldAlert className="size-4" />
                ) : (
                  <Ban className="size-4" />
                )}
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{title}</DialogTitle>
                  <Badge tone="brand" size="sm" className="shrink-0 whitespace-nowrap">
                    <IdentifierText>{`If-Match v${quotation.version}`}</IdentifierText>
                  </Badge>
                </div>
                <DialogDescription>{td.reasonCodeHint}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            <span className="font-semibold text-foreground">
              <IdentifierText>
                {quotation.documentNumber ?? quotation.draftReference ?? quotation.id}
              </IdentifierText>
            </span>
            <span className="text-muted-foreground">
              {partyDisplayName(quotation.partySnapshot) ?? td.notRecorded}
            </span>
          </div>

          <TradeWriteOutcome write={write} />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {qCopy.reasonTemplatesLabel}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {presets.map((preset) => {
                const active = trimmedReason === preset;
                return (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={pending}
                    onClick={() => setReasonCode(preset)}
                    className={cn(
                      "cursor-pointer rounded-full px-2.5 py-1 font-mono text-xs",
                      active &&
                        "border-destructive bg-destructive text-primary-foreground hover:bg-destructive/90",
                    )}
                  >
                    {preset}
                  </Button>
                );
              })}
            </div>
          </div>

          <Field label={td.reasonCode} hint={td.reasonCodeHint} required showLabel>
            <Textarea
              rows={2}
              value={reasonCode}
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              placeholder={qCopy.reasonPresetCustomerRequested}
              disabled={pending}
              onChange={(event) => setReasonCode(event.target.value)}
            />
          </Field>

          <Field label={qCopy.evidenceRefLabel} hint={qCopy.evidenceRefHint} showLabel>
            <Input
              size="sm"
              value={evidenceRef}
              maxLength={TRADE_EVIDENCE_REF_MAX_LENGTH}
              placeholder={qCopy.evidenceRefPlaceholder}
              disabled={pending}
              onChange={(event) => setEvidenceRef(event.target.value)}
            />
          </Field>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onClose}
              className="cursor-pointer"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={!canConfirm}
              loading={pending}
              className="cursor-pointer"
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
