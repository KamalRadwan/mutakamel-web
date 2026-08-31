"use client";

import { Button, Combobox, DegradedBanner, Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { QuotationCreateState } from "../hooks/useQuotationCreate";

/**
 * The customer picker is the only cursor-paged control in the portal.
 *
 * Blocked customers are **returned by the service, not filtered out**, and they
 * are rendered here disabled with the reason. Hiding them would leave a user
 * hunting for a customer that is on the list and cannot be used.
 */
export function CreateQuotationDrawer({ state }: { state: QuotationCreateState }) {
  const { t } = useI18n();
  const { customers } = state;

  return (
    <FormDrawer
      open={state.isOpen}
      onOpenChange={(open) => (open ? state.open() : state.close())}
      title={t.tradeDocuments.quotations.createTitle}
      description={t.tradeDocuments.quotations.createDescription}
      isDirty={state.selected !== null || state.currencyCode !== "" || state.draftReference !== ""}
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
      {customers.error ? (
        <DegradedBanner
          message={
            tradeDocumentMessage(customers.error.code, t.tradeDocuments.errors) ??
            (customers.error.status === 403
              ? t.tradeDocuments.quotations.customersUnavailable
              : t.tradeDocuments.quotations.customersRetry)
          }
        />
      ) : null}

      <Field label={t.tradeDocuments.quotations.customerLabel} required>
        <Combobox
          value={state.selected?.partyId}
          selectedLabel={state.selected?.displayName}
          onValueChange={state.select}
          onSearch={customers.setSearch}
          loading={customers.isLoading}
          options={customers.options.map((option) => ({
            value: option.partyId,
            label: option.displayName,
            description: option.quotationSelectable
              ? undefined
              : t.tradeDocuments.quotations.customerBlocked,
            disabled: !option.quotationSelectable,
          }))}
          placeholder={t.tradeDocuments.quotations.customerPlaceholder}
          searchPlaceholder={t.tradeDocuments.quotations.customerSearch}
          loadingLabel={t.common.loading}
          emptyLabel={t.tradeDocuments.quotations.customerEmpty}
        />
      </Field>

      {customers.hasMore ? (
        <Button variant="outline" size="sm" onClick={customers.loadMore} disabled={customers.isLoading}>
          {t.tradeDocuments.quotations.customerMore}
        </Button>
      ) : null}

      <Field
        label={t.tradeDocuments.currency}
        hint={t.tradeDocuments.currencyHint}
        required
      >
        <Input
          value={state.currencyCode}
          maxLength={3}
          onChange={(event) => state.setCurrencyCode(event.target.value.toUpperCase())}
        />
      </Field>

      <Field label={t.tradeDocuments.draftReference} hint={t.tradeDocuments.draftReferenceHint}>
        <Input
          value={state.draftReference}
          maxLength={80}
          onChange={(event) => state.setDraftReference(event.target.value)}
        />
      </Field>
    </FormDrawer>
  );
}
