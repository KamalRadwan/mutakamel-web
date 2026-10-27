"use client";

import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeLineEditor } from "../../documents/components/TradeLineEditor";
import { TradeWriteFields, TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import type { QuotationRevisionState } from "../hooks/useQuotationRevision";

export interface QuotationRevisionDrawerProps {
  state: QuotationRevisionState;
  currencyCode: string;
}

/**
 * A new revision — the only way a quotation's lines change.
 *
 * Terms are authored explicitly. Blank durations use the displayed defaults;
 * valid zero durations remain zero in the revision request.
 */
export function QuotationRevisionDrawer({ state, currencyCode }: QuotationRevisionDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;

  return (
    <FormDrawer
      open={state.isOpen}
      onOpenChange={(open) => (open ? state.open() : state.close())}
      title={td.quotations.revisionTitle}
      description={td.quotations.revisionDescription}
      isDirty={state.validUntil !== "" || state.lineDraft.lines.some((line) => line.itemId !== "")}
      isSubmitting={state.write.isWriting}
      submitDisabled={!state.canSubmit}
      onSubmit={() => void state.submit()}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <TradeWriteOutcome write={state.write} />
      <TradeWriteFields write={state.write}>
      <div className="dossier-card dossier-card-indigo space-y-3">
        <Field label={td.validUntil} required>
          <Input
            size="sm"
            placeholder={td.validUntil}
            type="date"
            value={state.validUntil}
            onChange={(event) => state.setValidUntil(event.target.value)}
          />
        </Field>
      </div>

      <div className="dossier-card dossier-card-violet space-y-3">
        <p className="text-xs font-semibold text-foreground">
          {td.executive.structuredTermsTitle}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={td.executive.paymentTermCodeLabel}>
            <Input
              size="sm"
              value={state.paymentTermCode}
              onChange={(e) => state.setPaymentTermCode(e.target.value)}
              placeholder="NET_30"
            />
          </Field>
          <Field label={td.executive.incotermCodeLabel}>
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
      </div>

      <TradeLineEditor
        state={state.lineDraft}
        currencyCode={currencyCode}
        disabled={state.write.isBlocked}
      />
      </TradeWriteFields>
    </FormDrawer>
  );
}

