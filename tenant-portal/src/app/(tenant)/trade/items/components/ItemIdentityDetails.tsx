"use client";

import { DetailSection, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { useItemReferenceData } from "../hooks/useItemReferenceData";
import { useItemReferenceOptions } from "../hooks/useItemReferenceOptions";
import { isItemKind, type Item } from "../item-contract";

export function ItemIdentityDetails({ item }: { item: Item }) {
  const { t, lang } = useI18n();
  const reference = useItemReferenceData(Boolean(item.ownerUserId));
  const relatedIds = [
    ...item.comboComponents.map((component) => component.componentItemId),
    ...item.optionalProducts.map((product) => product.optionalProductItemId),
  ];
  const related = useItemReferenceOptions(relatedIds.length > 0, relatedIds, item.id);
  const ownerName = reference.owners.find((owner) => owner.id === item.ownerUserId)?.name;

  return (
    <>
      <DetailSection
        title={t.trade.itemDetailTitle}
        description={t.trade.itemScopeNote}
        emptyValueLabel="—"
        fields={[
          { label: t.trade.itemCode, value: <IdentifierText>{item.canonicalCode}</IdentifierText> },
          {
            label: t.trade.itemKind,
            value: isItemKind(item.itemKind) ? t.trade[`itemKind_${item.itemKind}`] : item.itemKind,
          },
          { label: t.trade.itemBaseUom, value: <IdentifierText className="text-xs">{item.baseUomId}</IdentifierText> },
          {
            label: t.trade.itemCategory,
            value: item.categorySummary ? <span className="space-y-1">
              <span className="block">{item.categorySummary.path.map((segment) => segment.name).join(" / ")}</span>
              {!item.categorySummary.effectiveActive ? <span className="block text-xs text-muted-foreground">{t.trade.categories.assignedInactive}</span> : null}
            </span> : t.trade.categories.none,
          },
          { label: t.trade.itemBarcode, value: item.barcode ? <IdentifierText>{item.barcode}</IdentifierText> : null },
          {
            label: t.trade.itemOwner,
            value: ownerName ?? (item.ownerUserId ? <IdentifierText className="text-xs">{item.ownerUserId}</IdentifierText> : null),
          },
          { label: t.trade.itemWeightKg, value: item.weightKg },
          { label: t.trade.itemVolumeM3, value: item.volumeM3 },
          { label: t.trade.version, value: <IdentifierText>{item.version}</IdentifierText> },
          { label: t.trade.updatedAt, value: formatDateTime(item.updatedAt, lang) },
          { label: t.trade.itemNotes, value: item.notes, wide: true },
          {
            label: t.trade.itemVariantIdentity,
            wide: true,
            value: item.variantIdentity ? (
              <pre dir="ltr" className="overflow-x-auto font-mono text-xs">{JSON.stringify(item.variantIdentity, null, 2)}</pre>
            ) : null,
          },
        ]}
      />

      <DetailSection
        title={t.trade.itemDocumentDescriptions}
        description={t.trade.itemDocumentDescriptionsHint}
        emptyValueLabel="—"
        fields={[
          { label: t.trade.itemQuotationDescription, value: item.quotationDescription, wide: true },
          { label: t.trade.itemSalesOrderDescription, value: item.salesOrderDescription, wide: true },
          { label: t.trade.itemReceiptDescription, value: item.receiptDescription, wide: true },
          { label: t.trade.itemDeliveryDescription, value: item.deliveryOrderDescription, wide: true },
        ]}
      />

      {item.itemKind === "COMBO" ? (
        <RelationList
          title={t.trade.itemComboComponents}
          description={t.trade.itemComboComponentsHint}
          emptyLabel={t.trade.itemNoComboComponents}
          rows={item.comboComponents.map((component) => ({
            key: `${component.componentItemId}-${component.sortOrder}`,
            label: related.labelFor(component.componentItemId),
            suffix: `${t.trade.itemComponentQuantity}: ${component.quantity}`,
          }))}
        />
      ) : null}

      <RelationList
        title={t.trade.itemOptionalProducts}
        description={t.trade.itemOptionalProductsHint}
        emptyLabel={t.trade.itemNoOptionalProducts}
        rows={item.optionalProducts.map((product) => ({
          key: `${product.optionalProductItemId}-${product.sortOrder}`,
          label: related.labelFor(product.optionalProductItemId),
        }))}
      />
    </>
  );
}

function RelationList({
  title,
  description,
  emptyLabel,
  rows,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  rows: Array<{ key: string; label: string; suffix?: string }>;
}) {
  return (
    <DetailSection title={title} description={description}>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {rows.map((row, index) => (
            <li key={row.key} className="rounded-md border border-border p-3">
              <span className="block text-xs text-muted-foreground">{index + 1}</span>
              <span className="block text-sm font-medium text-foreground">{row.label}</span>
              {row.suffix ? <span className="block text-xs text-muted-foreground">{row.suffix}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </DetailSection>
  );
}
