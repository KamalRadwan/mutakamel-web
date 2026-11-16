"use client";

import {
  Combobox,
  Field,
  FormDrawer,
  Input,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeLineEditor } from "../../documents/components/TradeLineEditor";
import { TradeWriteFields, TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import {
  TRADE_NOTES_MAX_LENGTH,
  TRADE_REFERENCE_MAX_LENGTH,
} from "../../documents/trade-document-contract";
import type { PurchaseQuotationFormState } from "../hooks/usePurchaseQuotationForm";
import { PurchaseQuotationSupplierStatus } from "./PurchaseQuotationSupplierStatus";

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
      <TradeWriteOutcome write={state.write} />
      <TradeWriteFields write={state.write}>
      <PurchaseQuotationSupplierStatus state={state} isEdit={isEdit} />

      <Field
        label={t.tradeDocuments.purchaseQuotations.supplierLabel}
        hint={t.tradeDocuments.purchaseQuotations.supplierSearch}
        required
      >
        <Combobox
          value={state.values.supplierPartyId || undefined}
          selectedLabel={state.selectedSupplierLabel || t.tradeDocuments.purchaseQuotations.supplierPlaceholder}
          onValueChange={(next) => state.setValue({ supplierPartyId: next ?? "" })}
          onSearch={state.searchSuppliers}
          loading={state.isLoadingSuppliers}
          disabled={state.write.isBlocked}
          options={state.suppliers.map((supplier) => ({ value: supplier.partyId, label: supplier.displayName }))}
          placeholder={t.tradeDocuments.purchaseQuotations.supplierPlaceholder}
          searchPlaceholder={t.tradeDocuments.purchaseQuotations.supplierSearch}
          loadingLabel={t.common.loading}
          emptyLabel={t.tradeDocuments.purchaseQuotations.supplierEmpty}
          errorContent={state.suppliersError ? <p className="p-2 text-sm">{t.tradeDocuments.purchaseQuotations.suppliersUnavailable}</p> : undefined}
        />
      </Field>

      <Field label={t.tradeDocuments.currency} hint={t.tradeDocuments.currencyHint} required>
        <Input size="sm" placeholder={t.tradeDocuments.currency}
          value={state.values.currencyCode}
          maxLength={3}
          onChange={(event) => state.setValue({ currencyCode: event.target.value.toUpperCase() })}
        />
      </Field>

      <Field label={t.tradeDocuments.validUntil} required>
        <Input size="sm" placeholder={t.tradeDocuments.validUntil}
          type="date"
          value={state.values.validUntil}
          onChange={(event) => state.setValue({ validUntil: event.target.value })}
        />
      </Field>

      <Field label={t.tradeDocuments.reference}>
        <Input size="sm" placeholder={t.tradeDocuments.reference}
          value={state.values.reference}
          maxLength={TRADE_REFERENCE_MAX_LENGTH}
          onChange={(event) => state.setValue({ reference: event.target.value })}
        />
      </Field>

      <Field label={t.tradeDocuments.notes}>
        <Textarea placeholder={t.tradeDocuments.notes}
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
        disabled={state.write.isBlocked}
      />
      </TradeWriteFields>
    </FormDrawer>
  );
}
