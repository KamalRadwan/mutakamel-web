"use client";

import { Info, PackagePlus, Search } from "lucide-react";
import {
  Badge, Button, Checkbox, DegradedBanner, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, Field, IdentifierText, Input, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { TradeItemOption } from "../../documents/trade-lookup-contract";
import type { QuotationItemPickerState } from "../hooks/useQuotationItemPicker";
import { QuotationItemThumbnail } from "./QuotationItemIdentity";
import {
  QuotationItemPickerCards, QuotationPickerDescription,
  QuotationPickerLineAmount, QuotationPickerUnitPrice, resolvePickerItemRow,
} from "./QuotationItemPickerCards";
import { QuotationTotalsRibbon } from "./QuotationTotalsRibbon";

export function QuotationItemPickerModal({
  picker,
  draft,
  currencyCode,
  showBasePrices = false,
}: {
  picker: QuotationItemPickerState;
  draft: TradeLineDraftState;
  currencyCode: string;
  showBasePrices?: boolean;
}) {
  const { t, dir } = useI18n();
  const copy = t.quotationExperience;
  const descriptionLabel = t.coreOperations.templates.description;
  const visibleItems = picker.reviewSelection
    ? picker.rows.flatMap((row) => (draft.itemsById[row.itemId] ? [draft.itemsById[row.itemId]] : []))
    : draft.lookupError ? [] : draft.items;
  const selectedCount = visibleItems.filter((item) => picker.rows.some((row) => row.itemId === item.id)).length;
  const allSelected = visibleItems.length > 0 && selectedCount === visibleItems.length;

  return (
    <Dialog open={picker.open} onOpenChange={picker.setOpen}>
      <DialogContent
        size="2xl"
        className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-5xl! flex-col gap-0 overflow-hidden p-0 sm:p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <PackagePlus className="size-4 text-primary" aria-hidden="true" />
            {copy.itemPickerTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">{copy.itemPickerDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Field label={copy.searchCatalog} className="min-w-52 flex-1 gap-0">
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                size="sm"
                className="ps-8"
                placeholder={copy.searchCatalogPlaceholder}
                value={picker.search}
                maxLength={160}
                onChange={(event) => picker.searchItems(event.target.value)}
              />
            </div>
          </Field>
          <Badge tone="neutral" size="sm" className="font-normal">{copy.salesPurpose}</Badge>
          <div className="flex items-center gap-2 sm:border-s sm:border-border sm:ps-2.5">
            <span className="text-xs font-medium text-foreground">
              {copy.selectedItems.replace("{count}", String(picker.rows.length))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-primary"
              disabled={!picker.rows.length && !picker.reviewSelection}
              onClick={picker.toggleReview}
            >
              {picker.reviewSelection ? copy.showCatalog : copy.reviewSelected}
            </Button>
          </div>
        </div>

        {draft.lookupError ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5">
            <DegradedBanner
              message={
                tradeDocumentMessage(draft.lookupError.code, t.tradeDocuments.errors) ??
                t.tradeDocuments.lineEditor.lookupUnavailable
              }
            />
            <Button variant="outline" size="sm" onClick={picker.retry}>{t.common.retry}</Button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto px-4 py-2.5">
          {visibleItems.length > 0 ? (
            <>
              <QuotationItemPickerCards items={visibleItems} picker={picker} draft={draft} currencyCode={currencyCode} />
              <div className="hidden overflow-hidden rounded-lg border border-border lg:block">
                <Table>
                  <TableHeader className="bg-muted/70">
                    <TableRow className="h-8">
                      <TableHead scope="col" className="h-8 w-9 px-2.5 py-1">
                        <Checkbox
                          checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
                          disabled={!visibleItems.length || draft.isLoadingItems}
                          aria-label={copy.selectVisible}
                          onCheckedChange={() => picker.toggleVisible(visibleItems.map((item) => item.id))}
                        />
                      </TableHead>
                      <TableHead scope="col" className="h-8 w-[25%] min-w-44 px-2.5 py-1">{t.tradeDocuments.item}</TableHead>
                      <TableHead scope="col" className="h-8 w-[27%] min-w-48 px-2.5 py-1">{descriptionLabel}</TableHead>
                      <TableHead scope="col" className="h-8 w-32 px-2.5 py-1">{copy.unit}</TableHead>
                      <TableHead scope="col" className="h-8 w-24 px-2.5 py-1 text-end">{copy.quantity}</TableHead>
                      <TableHead scope="col" className="h-8 w-28 px-2.5 py-1 text-end">{copy.unitPrice}</TableHead>
                      <TableHead scope="col" className="h-8 w-28 px-2.5 py-1 text-end">{copy.lineAmount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item) => (
                      <PickerDesktopRow
                        key={item.id}
                        item={item}
                        picker={picker}
                        draft={draft}
                        currencyCode={currencyCode}
                        descriptionLabel={descriptionLabel}
                        dir={dir}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {draft.isLoadingItems && !picker.reviewSelection ? (
            <p role="status" className="p-5 text-center text-sm text-muted-foreground">{t.common.loading}</p>
          ) : visibleItems.length === 0 && (!draft.lookupError || picker.reviewSelection) ? (
            <p className="p-5 text-center text-sm text-muted-foreground">
              {picker.reviewSelection ? copy.selectionEmpty : copy.itemNoResults}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border px-4 py-2.5">
          <p className="flex items-start gap-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {showBasePrices ? copy.basePricingNote : copy.previewNote}
          </p>
          <QuotationTotalsRibbon total={picker.total} currencyCode={currencyCode} count={picker.rows.length} selection />
          {!picker.capacity ? (
            <p role="alert" className="text-xs text-destructive">{copy.maxLines}</p>
          ) : null}
        </div>
        <DialogFooter className="shrink-0 gap-2.5 px-4 pb-3 pt-1">
          <Button variant="outline" size="md" onClick={() => picker.setOpen(false)}>{t.common.cancel}</Button>
          <Button variant="primary" size="md" disabled={!picker.canAdd} onClick={picker.add}>
            {copy.addItemsCount.replace("{count}", String(picker.rows.length))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickerDesktopRow({
  item,
  picker,
  draft,
  currencyCode,
  descriptionLabel,
  dir,
}: {
  item: TradeItemOption;
  picker: QuotationItemPickerState;
  draft: TradeLineDraftState;
  currencyCode: string;
  descriptionLabel: string;
  dir: "ltr" | "rtl";
}) {
  const { t, lang } = useI18n();
  const copy = t.quotationExperience;
  const state = resolvePickerItemRow(item, lang, picker, draft);

  return (
    <TableRow
      data-state={state.row ? "selected" : undefined}
      className="h-9 odd:bg-card data-[state=selected]:bg-primary/5"
    >
      <TableCell className="px-2.5 py-1">
        <Checkbox
          checked={Boolean(state.row)}
          aria-label={`${copy.addItems}: ${state.name}`}
          onCheckedChange={() => picker.toggle(item.id)}
        />
      </TableCell>
      <TableCell className="max-w-56 px-2.5 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <QuotationItemThumbnail item={item} />
          <span className="truncate text-sm font-normal text-foreground">{state.name}</span>
          <Badge tone="brand" size="sm" className="shrink-0 font-normal">
            <IdentifierText>{item.canonicalCode}</IdentifierText>
          </Badge>
        </div>
      </TableCell>
      <TableCell className="max-w-64 px-2.5 py-1 font-normal">
        <QuotationPickerDescription description={state.description} label={descriptionLabel} dir={dir} />
      </TableCell>
      <TableCell className="px-2.5 py-1">
        {state.row ? (
          <Field label={`${copy.unit}: ${state.name}`} error={state.hasNoUnits ? copy.noUnits : undefined} className="gap-0">
            <Select dir={dir} value={state.row.uomId || undefined} onValueChange={(uomId) => picker.update(item.id, { uomId })}>
              <SelectTrigger size="sm" textSize="compact" className="h-7">
                <SelectValue placeholder={copy.selectUnit} />
              </SelectTrigger>
              <SelectContent textSize="compact">
                {(state.itemUoms ?? []).map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : state.itemUoms?.length === 1 ? (
          <span className="text-sm font-normal text-muted-foreground">{state.itemUoms[0].displayName}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-2.5 py-1 text-end">
        {state.row ? (
          <Field label={`${copy.quantity}: ${state.name}`} error={state.quantity === null ? copy.quantityInvalid : undefined} className="gap-0">
            <Input
              size="sm"
              inputMode="decimal"
              dir="ltr"
              maxLength={32}
              value={state.row.quantity}
              onChange={(event) => picker.update(item.id, { quantity: event.target.value })}
              className="ms-auto h-7 w-20 px-2 text-end tabular-nums"
            />
          </Field>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-2.5 py-1 text-end text-sm font-normal">
        <QuotationPickerUnitPrice state={state} currencyCode={currencyCode} />
      </TableCell>
      <TableCell className="px-2.5 py-1 text-end text-sm font-normal">
        <QuotationPickerLineAmount state={state} currencyCode={currencyCode} />
      </TableCell>
    </TableRow>
  );
}
