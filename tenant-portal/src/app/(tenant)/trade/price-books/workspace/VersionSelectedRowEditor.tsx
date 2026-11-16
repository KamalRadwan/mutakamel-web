"use client";
import { resolveCatalogCost } from "../catalog-cost";

import { Copy, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { formatDecimalString } from "@/lib/format/number";
import { useI18n } from "@/i18n/I18nContext";
import {
  localizedRecordName,
  type PriceBookVersionDetail,
  type PricingReferenceItem,
  type PricingReferenceUom,
} from "../pricing-contract";
import { formatDraftValidationIssue } from "../pricing-messages";
import type { DraftValidationIssue, PriceEntryDraft } from "../version-draft";

interface VersionSelectedRowEditorProps {
  detail: PriceBookVersionDetail;
  entry: PriceEntryDraft | null;
  rowIndex: number;
  editable: boolean;
  items: readonly PricingReferenceItem[];
  uoms: readonly PricingReferenceUom[];
  rowIssues: readonly DraftValidationIssue[];
  onUpdateEntry: (patch: Partial<PriceEntryDraft>) => void;
  onDuplicateEntry: () => void;
  onRemoveEntry: () => void;
}

export function VersionSelectedRowEditor({
  detail,
  entry,
  rowIndex,
  editable,
  items,
  uoms,
  rowIssues,
  onUpdateEntry,
  onDuplicateEntry,
  onRemoveEntry,
}: VersionSelectedRowEditorProps) {
  const { t, lang } = useI18n();
  const currency = detail.book.currencyCode;
  const purpose = detail.book.purpose;

  if (!entry) {
    return (
      <div className="rounded-card border border-dashed border-border bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
        {t.tradePricing.selectRowPrompt}
      </div>
    );
  }

  const rowKey = entry.key ?? `row-${rowIndex}`;
  const eligibleItems = items.filter(
    (item) =>
      item.itemId === entry.itemId ||
      (purpose === "PURCHASE" ? item.canPurchase : item.canSell),
  );
  const selectedItem = items.find((i) => i.itemId === entry.itemId);
  const storedEntry = detail.entries.find((e) => e.id === rowKey || e.itemId === entry.itemId);
  const stdCost = resolveCatalogCost(detail.canViewCost, storedEntry?.itemId === entry.itemId ? storedEntry : undefined, selectedItem);

  const issueText = (field: string): string | undefined => {
    const found = rowIssues.find((iss) => iss.field === field);
    return found ? formatDraftValidationIssue(found, t.tradePricing) : undefined;
  };

  const handleSelectItem = (itemId: string) => {
    const found = items.find((i) => i.itemId === itemId);
    const defaultUom =
      (purpose === "PURCHASE" ? found?.defaultPurchaseUomId : found?.defaultSalesUomId) ||
      found?.baseUomId ||
      entry.uomId;
    const refPrice =
      !entry.unitPrice.trim() && purpose === "SALES" && found?.currencyCode === currency && found.salesPrice ? found.salesPrice : entry.unitPrice;
    onUpdateEntry({ itemId, uomId: defaultUom ?? entry.uomId, unitPrice: refPrice });
  };

  return (
    <section
      aria-label={t.tradePricing.selectedRowEditorTitle}
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            {t.tradePricing.selectedRowEditorTitle} #{rowIndex + 1}
          </h3>
          <Badge tone="neutral">
            <IdentifierText className="text-badge">{currency}</IdentifierText>
          </Badge>
          {stdCost ? (
            <span className="text-caption text-muted-foreground">
              {t.tradePricing.standardCostColumn}:{" "}
              <IdentifierText className="text-caption">{`${formatDecimalString(stdCost.amount, lang, { maximumFractionDigits: 8 })} ${stdCost.currencyCode}`}</IdentifierText>
            </span>
          ) : null}
        </div>
        {editable ? (
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="outline" onClick={onDuplicateEntry}>
              <Copy className="me-1 size-3" aria-hidden="true" />
              {t.tradePricing.cloneEntry}
            </Button>
            <Button size="xs" variant="ghost" onClick={onRemoveEntry}>
              <Trash2 className="me-1 size-3 text-destructive" aria-hidden="true" />
              {t.tradePricing.deleteRow}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-caption text-muted-foreground">{t.tradePricing.selectedRowEditorHint}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t.tradePricing.itemColumn} showLabel error={issueText("itemId")}>
          {eligibleItems.length > 0 ? (
            <Select value={entry.itemId || undefined} onValueChange={handleSelectItem} disabled={!editable}>
              <SelectTrigger id={`entry-${rowKey}-itemId`} size="sm">
                <SelectValue placeholder={t.tradePricing.selectItemPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {eligibleItems.map((item) => (
                  <SelectItem key={item.itemId} value={item.itemId}>
                    {item.canonicalCode} — {localizedRecordName(item.localizedNames, item.canonicalCode, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`entry-${rowKey}-itemId`}
              size="sm"
              dir="ltr"
              disabled={!editable}
              value={entry.itemId}
              placeholder={t.tradePricing.itemId}
              onChange={(e) => onUpdateEntry({ itemId: e.target.value })}
            />
          )}
        </Field>

        <Field label={t.tradePricing.uomColumn} showLabel error={issueText("uomId")}>
          {uoms.length > 0 ? (
            <Select value={entry.uomId || undefined} onValueChange={(uomId) => onUpdateEntry({ uomId })} disabled={!editable}>
              <SelectTrigger id={`entry-${rowKey}-uomId`} size="sm">
                <SelectValue placeholder={t.tradePricing.selectUomPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {uoms.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.code} — {localizedRecordName(u.localizedNames, u.displayName, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`entry-${rowKey}-uomId`}
              size="sm"
              dir="ltr"
              disabled={!editable}
              value={entry.uomId}
              placeholder={t.tradePricing.uomId}
              onChange={(e) => onUpdateEntry({ uomId: e.target.value })}
            />
          )}
        </Field>

        <Field label={t.tradePricing.colFromIncluded} showLabel error={issueText("minimumQuantity")}>
          <Input
            id={`entry-${rowKey}-minimumQuantity`}
            size="sm"
            dir="ltr"
            inputMode="decimal"
            disabled={!editable}
            value={entry.minimumQuantity}
            onChange={(e) => onUpdateEntry({ minimumQuantity: e.target.value })}
          />
        </Field>

        <Field label={t.tradePricing.colBelowExcluded} showLabel error={issueText("maximumQuantity")}>
          <Input
            id={`entry-${rowKey}-maximumQuantity`}
            size="sm"
            dir="ltr"
            inputMode="decimal"
            disabled={!editable}
            placeholder={t.tradePricing.openEndedWindow}
            value={entry.maximumQuantity}
            onChange={(e) => onUpdateEntry({ maximumQuantity: e.target.value })}
          />
        </Field>

        <Field
          label={t.tradePricing.colUnitPriceCurrency.replace("{currency}", currency)}
          showLabel
          error={issueText("unitPrice")}
        >
          <Input
            id={`entry-${rowKey}-unitPrice`}
            size="sm"
            dir="ltr"
            inputMode="decimal"
            disabled={!editable}
            value={entry.unitPrice}
            onChange={(e) => onUpdateEntry({ unitPrice: e.target.value })}
          />
        </Field>

        <Field
          label={t.tradePricing.colFloorCurrency.replace("{currency}", currency)}
          showLabel
          error={issueText("minimumAllowedPrice")}
        >
          <Input
            id={`entry-${rowKey}-minimumAllowedPrice`}
            size="sm"
            dir="ltr"
            inputMode="decimal"
            disabled={!editable}
            placeholder={t.tradePricing.floorGuardNone}
            value={entry.minimumAllowedPrice}
            onChange={(e) => onUpdateEntry({ minimumAllowedPrice: e.target.value })}
          />
        </Field>

        <Field label={t.tradePricing.priority} showLabel error={issueText("priority")}>
          <Input
            id={`entry-${rowKey}-priority`}
            size="sm"
            dir="ltr"
            inputMode="numeric"
            disabled={!editable}
            value={entry.priority}
            onChange={(e) => onUpdateEntry({ priority: e.target.value })}
          />
        </Field>
      </div>
    </section>
  );
}
