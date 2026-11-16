"use client";

import { Copy, Layers, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, IdentifierText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/design-system";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { localizedRecordName } from "../../../price-books/pricing-contract";
import { VersionMatrixHeaderControls } from "../../../price-books/workspace/VersionMatrixHeaderControls";
import { VersionSelectedRowEditor } from "../../../price-books/workspace/VersionSelectedRowEditor";
import { resolveCatalogCost } from "../../../price-books/catalog-cost";
import { useVersionMatrixEditor, type VersionMatrixEditorProps } from "../hooks/useVersionMatrixEditor";
export function VersionMatrixEditor(props: VersionMatrixEditorProps) {
  const { detail, draft, onChangeDraft, editable, items, uoms, currencyDecimalPlaces, t, lang, currency, showCost, search, setSearch, setPage, setSelectedKey, itemById, uomById, storedByKey, report, issuesByRowKey, filtered, totalPages, safePage, pagedRows, activeSelection, addRow, updateRow, duplicateRow, removeRow, PAGE_SIZE } = useVersionMatrixEditor(props);
  const priceFormat = { minimumFractionDigits: currencyDecimalPlaces ?? 0, maximumFractionDigits: 8 };
  return (
    <div className="flex flex-col gap-3">
      <VersionMatrixHeaderControls
        detail={detail}
        draft={draft}
        editable={editable}
        currencyDecimalPlaces={currencyDecimalPlaces}
        matchingKeys={filtered.map(row => row.rowKey)}
        search={search}
        issues={report.issues}
        onChangeSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        onChangeDraft={onChangeDraft}
        onAddRow={addRow}
      />

      {draft.entries.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-6">
          <EmptyState
            icon={Layers}
            title={t.tradePricing.emptyMatrixDraftTitle}
            description={t.tradePricing.emptyMatrixDraftDesc}
            action={editable ? { label: t.tradePricing.addItemTierAction, onClick: addRow } : undefined}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <Table className="table-auto">
            <TableHeader>
              <TableRow>
                <TableHead>{t.tradePricing.itemColumn}</TableHead>
                <TableHead>{t.tradePricing.uomColumn}</TableHead>
                <TableHead className="whitespace-nowrap text-end">{t.tradePricing.colFromIncluded}</TableHead>
                <TableHead className="whitespace-nowrap text-end">{t.tradePricing.colBelowExcluded}</TableHead>
                <TableHead className="whitespace-nowrap text-end">{t.tradePricing.colUnitPriceCurrency.replace("{currency}", currency)}</TableHead>
                <TableHead className="whitespace-nowrap text-end">{t.tradePricing.colFloorCurrency.replace("{currency}", currency)}</TableHead>
                {showCost ? <TableHead className="whitespace-nowrap text-end">{t.tradePricing.standardCostColumn}</TableHead> : null}
                <TableHead className="whitespace-nowrap text-end">{t.tradePricing.priority}</TableHead>
                {editable ? <TableHead className="w-20 text-end">{t.tradePricing.moreActions}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map(({ entry, idx, rowKey }) => {
                const it = itemById.get(entry.itemId);
                const st = storedByKey.get(rowKey);
                const uom = uomById.get(entry.uomId);
                const itemCode = it?.canonicalCode ?? st?.itemCode ?? entry.itemId;
                const itemName = localizedRecordName(it?.localizedNames ?? st?.itemLocalizedNames, itemCode, lang);
                const uomLabel = localizedRecordName(uom?.localizedNames ?? st?.uomLocalizedNames, uom?.displayName ?? st?.uomDisplayName ?? uom?.code ?? st?.uomCode ?? t.common.unknownCode, lang);
                const rowErrs = issuesByRowKey.get(rowKey) ?? [];
                const isSelected = activeSelection?.rowKey === rowKey;
                const costVal = resolveCatalogCost(detail.canViewCost, st?.itemId === entry.itemId ? st : undefined, it);

                return (
                  <TableRow
                    key={rowKey}
                    onClick={() => setSelectedKey(rowKey)}
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedKey(rowKey); } }}
                    className={cn(
                      "cursor-pointer font-normal",
                      rowErrs.length > 0 && "bg-destructive-subtle/40",
                      isSelected && "bg-selected",
                    )}
                  >
                    <TableCell className="font-normal">
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground">{itemName || t.tradePricing.selectItemPlaceholder}</span>
                        <IdentifierText title={itemCode || undefined} className="block max-w-52 truncate text-caption text-muted-foreground">{itemCode || "—"}</IdentifierText>
                      </div>
                    </TableCell>
                    <TableCell className="font-normal"><Badge tone="neutral">{uomLabel || "—"}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-end font-normal"><IdentifierText className="text-xs">{formatDecimalString(entry.minimumQuantity || "0", lang, { maximumFractionDigits: 8 })}</IdentifierText></TableCell>
                    <TableCell className="whitespace-nowrap text-end font-normal"><IdentifierText className="text-xs">{entry.maximumQuantity ? formatDecimalString(entry.maximumQuantity, lang, { maximumFractionDigits: 8 }) : t.tradePricing.noUpperLimitSymbol}</IdentifierText></TableCell>
                    <TableCell className="whitespace-nowrap text-end font-normal"><IdentifierText className="text-xs">{entry.unitPrice ? formatDecimalString(entry.unitPrice, lang, priceFormat) : "—"}</IdentifierText></TableCell>
                    <TableCell className="whitespace-nowrap text-end font-normal"><IdentifierText className="text-xs">{entry.minimumAllowedPrice !== "" ? formatDecimalString(entry.minimumAllowedPrice, lang, priceFormat) : t.tradePricing.noUpperLimitSymbol}</IdentifierText></TableCell>
                    {showCost ? (
                      <TableCell className="whitespace-nowrap text-end font-normal">
                        <IdentifierText className="text-xs text-muted-foreground">{costVal ? `${formatDecimalString(costVal.amount, lang, { maximumFractionDigits: 8 })} ${costVal.currencyCode}` : t.tradePricing.noUpperLimitSymbol}</IdentifierText>
                      </TableCell>
                    ) : null}
                    <TableCell className="whitespace-nowrap text-end font-normal"><IdentifierText className="text-xs">{entry.priority}</IdentifierText></TableCell>
                    {editable ? (
                      <TableCell className="whitespace-nowrap text-end font-normal">
                        <div className="inline-flex items-center gap-1">
                          <Button size="xs" variant="ghost" aria-label={t.tradePricing.cloneEntry} onClick={(e) => { e.stopPropagation(); duplicateRow(entry, idx); }}>
                            <Copy className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button size="xs" variant="ghost" aria-label={t.tradePricing.deleteRow} onClick={(e) => { e.stopPropagation(); removeRow(idx); }}>
                            <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-3.5 py-2 text-caption text-muted-foreground">
            <span>{t.tradePricing.matrixHalfOpenLegend}</span>
            <div className="flex items-center gap-2">
              <span>
                {t.tradePricing.showingRowsRange
                  .replace("{start}", formatNumber(filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1, lang))
                  .replace("{end}", formatNumber(Math.min(safePage * PAGE_SIZE, filtered.length), lang))
                  .replace("{total}", formatNumber(filtered.length, lang))}
              </span>
              {totalPages > 1 ? (
                <>
                  <Button size="xs" variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t.tradePricing.prevPageShort}</Button>
                  <Button size="xs" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{t.tradePricing.nextPageShort}</Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {editable && draft.entries.length > 0 ? (
        <VersionSelectedRowEditor
          detail={detail}
          entry={activeSelection?.entry ?? null}
          rowIndex={activeSelection?.idx ?? 0}
          editable={editable}
          items={items}
          uoms={uoms}
          rowIssues={activeSelection ? (issuesByRowKey.get(activeSelection.rowKey) ?? []) : []}
          onUpdateEntry={(patch) => { if (activeSelection) updateRow(activeSelection.idx, patch); }}
          onDuplicateEntry={() => { if (activeSelection) duplicateRow(activeSelection.entry, activeSelection.idx); }}
          onRemoveEntry={() => { if (activeSelection) removeRow(activeSelection.idx); }}
        />
      ) : null}
    </div>
  );

}
