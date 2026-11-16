"use client";

import { DetailSection, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { CommercialPreparationRequest } from "../commercial-command-request";
import { commercialLabel, createCommercialLabels, type CommercialLabels } from "../commercial-labels";

export function CommercialChangeList({ request, labels = createCommercialLabels() }: { request: CommercialPreparationRequest; labels?: CommercialLabels }) {
  const { t, lang } = useI18n();
  const copy = t.commercialPurchase;
  return <div className="flex min-w-0 flex-col gap-3">
    <DetailSection title={copy.request} emptyValueLabel={t.detail.notRecorded} fields={[
      { label: t.commercialReceipt.revision, value: <IdentifierText>{request.expectedSubscriptionRevision}</IdentifierText> },
      { label: copy.reason, value: request.reason },
    ]} />
    {request.changes.map((row) => <section key={row.selectionKey} className="flex min-w-0 flex-col gap-3">
      <DetailSection title={commercialLabel(labels, row, copy.status[row.sourceKind], request.changes)} fields={[
      { label: t.commercialReceipt.change, value: copy.status[row.operation] },
      ...("seats" in row && row.seats !== undefined ? [{ label: t.coreBilling.seats, value: formatNumber(row.seats, lang) }] : []),
    ]} />
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">{copy.technicalIdentifiers}</summary>
      <DetailSection title={copy.technicalIdentifiers} fields={[
      { label: t.commercialReceipt.selectionKey, value: <IdentifierText>{row.selectionKey}</IdentifierText> },
      ...("applicationId" in row ? [{ label: copy.applicationId, value: <IdentifierText>{row.applicationId}</IdentifierText> }] : []),
      ...("itemId" in row ? [{ label: copy.itemId, value: <IdentifierText>{row.itemId}</IdentifierText> }] : []),
      ...("tierId" in row && row.tierId ? [{ label: copy.tierId, value: <IdentifierText>{row.tierId}</IdentifierText> }] : []),
      ...("addonId" in row ? [{ label: copy.addonId, value: <IdentifierText>{row.addonId}</IdentifierText> }] : []),
      ...("addonSelectionId" in row ? [{ label: t.commercialReceipt.selection, value: <IdentifierText>{row.addonSelectionId}</IdentifierText> }] : []),
      ...("targetDefinitionVersionId" in row && row.targetDefinitionVersionId ? [{ label: copy.definition, value: <IdentifierText>{row.targetDefinitionVersionId}</IdentifierText> }] : []),
      ...("parentItemId" in row ? [{ label: copy.parentItem, value: <IdentifierText>{row.parentItemId}</IdentifierText> }] : []),
      ...("parentSelectionKey" in row ? [{ label: copy.parentSelection, value: <IdentifierText>{row.parentSelectionKey}</IdentifierText> }] : []),
    ]} /></details></section>)}
  </div>;
}
