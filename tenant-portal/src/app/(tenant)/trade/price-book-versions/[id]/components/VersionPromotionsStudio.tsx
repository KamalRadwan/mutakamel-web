"use client";

import { Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, IdentifierText, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { PROMOTIONS_MAX } from "../../../price-books/pricing-contract";
import { VersionPromotionEditorCard } from "../../../price-books/workspace/VersionPromotionEditorCard";
import { useVersionPromotionsStudio, type VersionPromotionsStudioProps } from "../hooks/useVersionPromotionsStudio";
export function VersionPromotionsStudio(props: VersionPromotionsStudioProps) {
  const { purpose, currencyCode, draft, editable, items, uoms, branches, channels, channelBranchIdsByChannel, accounts, t, lang, search, setSearch, setSelectedKey, issuesByRowKey, filtered, activeSelection, addPromotion, updatePromotion, removePromotion, summarizeAppliesTo } = useVersionPromotionsStudio(props);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-card border border-info/30 bg-info-subtle/60 px-4 py-3 text-xs">
        <p className="font-semibold text-foreground">{t.tradePricing.promoRulesHowTitle}</p>
        <ul className="mt-1.5 grid grid-cols-1 gap-1 text-muted-foreground sm:grid-cols-2">
          <li>{t.tradePricing.promoRulesStep1}</li>
          <li>{t.tradePricing.promoRulesStep2}</li>
          <li>{t.tradePricing.promoRulesStep3}</li>
          <li>{t.tradePricing.promoRulesStep4}</li>
        </ul>
        <p className="mt-2 border-t border-info/20 pt-1.5 text-caption text-muted-foreground">
          {t.tradePricing.promoVersionDatesFooter}
          {draft.effectiveFrom
            ? ` · ${formatDateTime(draft.effectiveFrom, lang)} → ${draft.effectiveTo ? formatDateTime(draft.effectiveTo, lang) : t.tradePricing.openEndedWindow}`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-card px-3.5 py-2.5">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="promotions-search-input" aria-label={t.tradePricing.promoSearchPlaceholder} size="sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.tradePricing.promoSearchPlaceholder} className="ps-8" />
        </div>
        {editable ? (
          <Button size="sm" variant="outline" disabled={draft.promotions.length >= PROMOTIONS_MAX} onClick={addPromotion}>
            <Plus className="me-1.5 size-3.5" aria-hidden="true" />
            {t.tradePricing.addPromotion}
          </Button>
        ) : null}
      </div>

      {draft.promotions.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-6">
          <EmptyState
            icon={Sparkles}
            title={t.tradePricing.noPromotions}
            description={t.tradePricing.promoEqualPrecedenceNote}
            action={editable ? { label: t.tradePricing.addPromotion, onClick: addPromotion } : undefined}
          />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-end">{t.tradePricing.priority}</TableHead>
                  <TableHead>{t.tradePricing.promotionName}</TableHead>
                  <TableHead className="text-end">{t.tradePricing.promoDiscountCol}</TableHead>
                  <TableHead>{t.tradePricing.promoAppliesToCol}</TableHead>
                  <TableHead className="text-end">{t.tradePricing.promoQtyRangeCol}</TableHead>
                  <TableHead>{t.tradePricing.promoRuleModeCol}</TableHead>
                  {editable ? <TableHead className="w-14 text-end">{t.tradePricing.moreActions}</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ promo, idx, rowKey }) => {
                  const rowErrs = issuesByRowKey.get(rowKey) ?? [];
                  const isSelected = activeSelection?.rowKey === rowKey;
                  const discountText =
                    promo.benefitType === "PERCENTAGE"
                      ? `-${promo.discountValue || "0"}%`
                      : `-${promo.discountValue || "0"} ${currencyCode}`;
                  return (
                    <TableRow
                      key={rowKey}
                      onClick={() => setSelectedKey(rowKey)}
                      className={cn(
                        "cursor-pointer font-normal",
                        rowErrs.length > 0 && "bg-destructive-subtle/40",
                        isSelected && "bg-selected",
                      )}
                    >
                      <TableCell className="text-end font-normal"><IdentifierText className="text-xs">{promo.priority}</IdentifierText></TableCell>
                      <TableCell className="font-normal">
                        <div className="flex flex-col">
                          <span className="text-xs text-foreground">{promo.name || "—"}</span>
                          <IdentifierText className="text-caption text-muted-foreground">{promo.code || "—"}</IdentifierText>
                        </div>
                      </TableCell>
                      <TableCell className="text-end font-normal"><IdentifierText className="text-xs text-foreground">{discountText}</IdentifierText></TableCell>
                      <TableCell className="font-normal text-xs text-muted-foreground">{summarizeAppliesTo(promo)}</TableCell>
                      <TableCell className="text-end font-normal">
                        <IdentifierText className="text-xs">{`${promo.minimumQuantity || "0"} → ${promo.maximumQuantity || t.tradePricing.noUpperLimitSymbol}`}</IdentifierText>
                      </TableCell>
                      <TableCell className="font-normal">
                        <Badge tone={promo.exclusive ? "caution" : "neutral"}>
                          {promo.exclusive ? t.tradePricing.exclusive : t.tradePricing.promoGroupBadge.replace("{group}", promo.stackGroup || "DEFAULT")}
                        </Badge>
                      </TableCell>
                      {editable ? (
                        <TableCell className="text-end font-normal">
                          <Button size="xs" variant="ghost" aria-label={t.tradePricing.removePromotionAction} onClick={(e) => { e.stopPropagation(); removePromotion(idx); }}>
                            <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {activeSelection ? (
            <VersionPromotionEditorCard
              purpose={purpose}
              currencyCode={currencyCode}
              promo={activeSelection.promo}
              rowIndex={activeSelection.idx}
              rowKey={activeSelection.rowKey}
              editable={editable}
              items={items}
              uoms={uoms}
              branches={branches}
              channels={channels}
              channelBranchIdsByChannel={channelBranchIdsByChannel}
              accounts={accounts}
              rowIssues={issuesByRowKey.get(activeSelection.rowKey) ?? []}
              onUpdate={(patch) => updatePromotion(activeSelection.idx, patch)}
              onRemove={() => removePromotion(activeSelection.idx)}
            />
          ) : null}
        </>
      )}
    </div>
  );

}
