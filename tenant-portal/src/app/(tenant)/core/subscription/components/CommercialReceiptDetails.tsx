"use client";

import { DataTable, DateTime, DetailSection, IdentifierText, Money, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useBillingTableLabels } from "../../billing/hooks/useBillingTableLabels";
import type { CommercialApplyReceipt } from "../commercial-apply";

type Change = CommercialApplyReceipt["changes"][number];

export function CommercialReceiptDetails({ receipt }: { receipt: CommercialApplyReceipt }) {
  const { t } = useI18n();
  const copy = t.commercialReceipt;
  const labels = useBillingTableLabels(copy.loadFailed, copy.notFound);
  const settlement = receipt.settlement;
  const columns: ColumnDef<Change>[] = [
    { id: "source", header: copy.source, cell: (row) => copy.status[row.sourceKind] },
    { id: "operation", header: copy.change, cell: (row) => row.operation === "ADOPT_DEFINITION" ? t.commercialAdoption.status.ADOPT_DEFINITION : copy.status[row.operation] },
    { id: "selection", header: copy.selection, cell: (row) => <IdentifierText>{row.selectionId}</IdentifierText> },
    { id: "selectionKey", header: copy.selectionKey, cell: (row) => <IdentifierText>{row.selectionKey}</IdentifierText> },
  ];
  return <div className="flex min-w-0 flex-col gap-4">
    <DetailSection title={copy.record} description={copy.historical} fields={[
      { label: copy.preview, value: <IdentifierText>{receipt.previewId}</IdentifierText> },
      { label: copy.operation, value: <IdentifierText>{receipt.operationId}</IdentifierText> },
      { label: copy.appliedAt, value: <DateTime value={receipt.appliedAt} /> },
      { label: copy.revision, value: <IdentifierText>{receipt.subscriptionRevision}</IdentifierText> },
    ]} />
    <DetailSection title={copy.totals} fields={[
      { label: t.subscriptionAddons.baseRecurring, value: <Money value={receipt.totals.baseRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: t.subscriptionAddons.addonRecurring, value: <Money value={receipt.totals.addonRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: t.subscriptionAddons.combinedRecurring, value: <Money value={receipt.totals.combinedRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
    ]} />
    <DetailSection title={copy.settlement} description={settlement ? copy.settlementNotice : undefined} fields={settlement ? [
      { label: copy.direction, value: copy.status[settlement.direction] },
      { label: copy.amount, value: <Money value={settlement.amountUsd} currency={settlement.currencyCode} maximumFractionDigits={4} /> },
      { label: copy.balance, value: <Money value={settlement.balanceAfterUsd} currency={settlement.currencyCode} maximumFractionDigits={4} /> },
      { label: copy.wallet, value: <IdentifierText>{settlement.walletId}</IdentifierText> },
      { label: copy.ledgerEntry, value: <IdentifierText>{settlement.walletLedgerEntryId}</IdentifierText> },
    ] : [{ label: copy.direction, value: copy.noSettlement }]} />
    <DetailSection title={copy.projection} description={copy.projectionNotice} fields={[
      { label: copy.projectionState, value: copy.status[receipt.projection.state] },
      { label: copy.preparation, value: <IdentifierText>{receipt.projection.preparationId}</IdentifierText> },
    ]} />
    <section className="min-w-0 rounded-md border border-border p-4" aria-label={copy.changes}>
      <h2 className="mb-3 text-sm font-semibold">{copy.changes}</h2>
      <DataTable columns={columns} rows={receipt.changes} rowKey={(row) => row.selectionKey} isLoading={false} labels={labels} showRowNumbers={false} />
    </section>
  </div>;
}
