"use client";

import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeLineEditor } from "../../documents/components/TradeLineEditor";
import type { QuotationRevisionState } from "../hooks/useQuotationRevision";

export interface QuotationRevisionDrawerProps {
  state: QuotationRevisionState;
  currencyCode: string;
}

/**
 * A new revision — the only way a quotation's lines change.
 *
 * `CreateQuotationRevisionDto` carries `validUntil`, the line set, and an
 * optional `terms` that defaults to `{}`. `terms` is **omitted** here rather
 * than composed: there is no published schema for a document terms snapshot
 * (Q32), and the server's own default is the only honest value. The cost of
 * that is recorded as Q80 — a revision with empty terms can never be converted
 * to a sales order, because the conversion check requires non-empty terms.
 */
export function QuotationRevisionDrawer({ state, currencyCode }: QuotationRevisionDrawerProps) {
  const { t } = useI18n();

  return (
    <FormDrawer
      open={state.isOpen}
      onOpenChange={(open) => (open ? state.open() : state.close())}
      title={t.tradeDocuments.quotations.revisionTitle}
      description={t.tradeDocuments.quotations.revisionDescription}
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
      <Field label={t.tradeDocuments.validUntil} required>
        <Input
          type="date"
          value={state.validUntil}
          onChange={(event) => state.setValidUntil(event.target.value)}
        />
      </Field>

      <TradeLineEditor
        state={state.lineDraft}
        currencyCode={currencyCode}
        disabled={state.write.isWriting}
      />
    </FormDrawer>
  );
}
