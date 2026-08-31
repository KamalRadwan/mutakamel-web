"use client";

import {
  DegradedBanner,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeLineEditor } from "../../documents/components/TradeLineEditor";
import {
  TRADE_NOTES_MAX_LENGTH,
  TRADE_REFERENCE_MAX_LENGTH,
} from "../../documents/trade-document-contract";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { PurchaseQuotationFormState } from "../hooks/usePurchaseQuotationForm";
import { supplierOptionLabel } from "../purchase-quotation-contract";

export interface PurchaseQuotationDrawerProps {
  state: PurchaseQuotationFormState;
  isEdit: boolean;
}

export function PurchaseQuotationDrawer({ state, isEdit }: PurchaseQuotationDrawerProps) {
  const { t } = useI18n();

  return (
    <FormDrawer
      open={state.isOpen}
      onOpenChange={(open) => (open ? state.open() : state.close())}
      title={
        isEdit
          ? t.tradeDocuments.purchaseQuotations.editTitle
          : t.tradeDocuments.purchaseQuotations.createTitle
      }
      description={
        isEdit
          ? t.tradeDocuments.purchaseQuotations.editDescription
          : t.tradeDocuments.purchaseQuotations.createDescription
      }
      isDirty={state.values.supplierPartyId !== "" || state.values.currencyCode !== ""}
      isSubmitting={state.write.isWriting}
      submitDisabled={!state.canSubmit}
      onSubmit={() => void state.submit()}
      error={state.formError ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {state.suppliersError ? (
        <DegradedBanner
          message={
            tradeDocumentMessage(state.suppliersError.code, t.tradeDocuments.errors) ??
            t.tradeDocuments.purchaseQuotations.suppliersUnavailable
          }
        />
      ) : null}

      {/* Trade publishes no supplier name anywhere: the commercial-account row
          carries `party_id` and nothing else, and the lookups route returns
          payment terms rather than accounts. The id is shown because it is the
          only identity that exists, not because a name was dropped. */}
      <Field
        label={t.tradeDocuments.purchaseQuotations.supplierLabel}
        hint={t.tradeDocuments.purchaseQuotations.supplierSearch}
        required
      >
        <Select
          value={state.values.supplierPartyId}
          onValueChange={(next) => state.setValue({ supplierPartyId: next })}
          disabled={state.isLoadingSuppliers || state.suppliers.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.tradeDocuments.purchaseQuotations.supplierPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {state.suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.partyId}>
                <span className="font-mono">{supplierOptionLabel(supplier)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.tradeDocuments.currency} hint={t.tradeDocuments.currencyHint} required>
        <Input
          value={state.values.currencyCode}
          maxLength={3}
          onChange={(event) => state.setValue({ currencyCode: event.target.value.toUpperCase() })}
        />
      </Field>

      <Field label={t.tradeDocuments.validUntil} required>
        <Input
          type="date"
          value={state.values.validUntil}
          onChange={(event) => state.setValue({ validUntil: event.target.value })}
        />
      </Field>

      <Field label={t.tradeDocuments.reference}>
        <Input
          value={state.values.reference}
          maxLength={TRADE_REFERENCE_MAX_LENGTH}
          onChange={(event) => state.setValue({ reference: event.target.value })}
        />
      </Field>

      <Field label={t.tradeDocuments.notes}>
        <Textarea
          value={state.values.notes}
          maxLength={TRADE_NOTES_MAX_LENGTH}
          onChange={(event) => state.setValue({ notes: event.target.value })}
        />
      </Field>

      {isEdit ? (
        <p className="text-xs text-muted-foreground">
          {t.tradeDocuments.purchaseQuotations.linesReplaced}
        </p>
      ) : null}

      <TradeLineEditor
        state={state.lineDraft}
        currencyCode={state.values.currencyCode}
        disabled={state.write.isWriting}
      />
    </FormDrawer>
  );
}
