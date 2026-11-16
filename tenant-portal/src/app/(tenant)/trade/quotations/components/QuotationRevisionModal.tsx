"use client";

import { Layers } from "lucide-react";
import { Badge, Button, Checkbox, Field, FormModal, IdentifierText, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { QuotationLineWorkspace } from "./QuotationLineWorkspace";
import { QuotationPricingControls } from "./QuotationPricingControls";
import {
  TradeWriteFields,
  TradeWriteOutcome,
} from "../../documents/components/TradeBoundaryStates";
import type { QuotationRevisionState } from "../hooks/useQuotationRevision";

export interface QuotationRevisionModalProps {
  state: QuotationRevisionState;
  currencyCode: string;
  version: number;
}

/**
 * Centered Wide Modal (`FormModal size="wide"`) for `POST /quotations/:id/revisions`.
 *
 * Replaces `QuotationRevisionDrawer` using Ocean Navy v3 surface tokens (zero
 * side drawers, zero purple/violet classes).
 */
export function QuotationRevisionModal({
  state,
  currencyCode,
  version,
}: QuotationRevisionModalProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const qCopy = td.quotations;
  const saveError = state.write.writeError;
  const pricingPolicyRefused = !state.sourceChanged
    && saveError?.status === 409 && saveError.code === "TRADE.PRICE.MARGIN_GUARD";

  return (
    <FormModal
      open={state.isOpen}
      onOpenChange={(open) => (open ? state.open() : state.close())}
      size="document"
      title={qCopy.revisionTitle}
      description={qCopy.revisionDescription}
      headerIcon={
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"
        >
          <Layers className="size-4" />
        </span>
      }
      titleBadge={
        <Badge tone="brand" size="sm">
          <IdentifierText>{`If-Match v${version}`}</IdentifierText>
        </Badge>
      }
      isDirty={
        state.validUntil !== "" || state.lineDraft.lines.some((line) => line.itemId !== "")
        || state.pricing.discount.draft.mode !== "NONE"
      }
      isSubmitting={state.write.isWriting}
      submitDisabled={!state.canSubmit}
      onSubmit={() => void state.submit()}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        close: t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: qCopy.revisionTitle,
        sectionInvalid: td.lineEditor.calculationInvalid,
      }}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <TradeWriteOutcome write={state.write} />
        {pricingPolicyRefused ? (
          <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
            {t.quotationExperience.revisionPricingPolicyRefused}
          </p>
        ) : null}
        {state.canPrepareReplacement ? <section className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-sm">{t.quotationExperience.replacementOffer}</p>
          <Button type="button" variant="outline" size="sm" className="h-auto min-h-(--size-control-sm) whitespace-normal py-1" onClick={state.prepareReplacement}>{t.quotationExperience.prepareReplacement}</Button>
          {state.replacementHandoffFailed ? <p role="alert" className="text-sm text-destructive">{t.quotationFlow.handoffFailed}</p> : null}
        </section> : null}
        {state.sourceChanged ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{t.quotationDiscount.revisionSourceChanged}</p> : null}
        {state.requiresSupersedeConfirmation ? <div className="space-y-3 rounded-md border border-kpi-rated-line bg-kpi-rated-surface p-4 text-sm">
          <p className="font-medium">{t.quotationDiscount.supersedeTitle}</p><p className="text-muted-foreground">{t.quotationDiscount.supersedeDescription}</p>
          <Field label={t.quotationDiscount.supersedeConfirm} showLabel required><Checkbox checked={state.supersedeConfirmed}
            disabled={state.write.isBlocked} onCheckedChange={(value) => state.setSupersedeConfirmed(value === true)} /></Field>
        </div> : null}
        <TradeWriteFields write={state.write}>
          <div className="grid grid-cols-1 gap-3.5 rounded-lg border border-border bg-card p-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={td.validUntil} required showLabel>
              <Input
                size="sm"
                placeholder={td.validUntil}
                type="date"
                value={state.validUntil}
                onChange={(event) => state.setValidUntil(event.target.value)}
              />
            </Field>
            <Field label={td.executive.paymentTermCodeLabel} showLabel>
              <Input
                size="sm"
                value={state.paymentTermCode}
                onChange={(e) => state.setPaymentTermCode(e.target.value)}
                placeholder="NET_30"
              />
            </Field>
            <Field label={td.executive.incotermCodeLabel} showLabel>
              <Input
                size="sm"
                value={state.incotermCode}
                onChange={(e) => state.setIncotermCode(e.target.value)}
                placeholder="EXW"
              />
            </Field>
            <Field
              label={td.executive.deliveryDaysLabel}
              error={state.deliveryDaysError}
              hint={td.executive.revisionDeliveryDaysHint}
              showLabel
            >
              <Input
                size="sm"
                inputMode="numeric"
                value={state.deliveryDays}
                onChange={(e) => state.setDeliveryDays(e.target.value)}
                placeholder="14"
              />
            </Field>
            <Field
              label={td.executive.warrantyMonthsLabel}
              error={state.warrantyMonthsError}
              hint={td.executive.revisionWarrantyMonthsHint}
              showLabel
            >
              <Input
                size="sm"
                inputMode="numeric"
                value={state.warrantyMonths}
                onChange={(e) => state.setWarrantyMonths(e.target.value)}
                placeholder="12"
              />
            </Field>
          </div>

          <QuotationPricingControls state={state.pricing} currencyCode={currencyCode} disabled={state.write.isBlocked} />
          <QuotationLineWorkspace draft={state.lineDraft} pricing={state.pricing} headers={state.headers}
            partyId={state.partyId} currencyCode={currencyCode} disabled={state.write.isBlocked} compact />
        </TradeWriteFields>
      </div>
    </FormModal>
  );
}
