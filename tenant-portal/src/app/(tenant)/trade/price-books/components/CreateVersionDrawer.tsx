"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Layers,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Field,
  FormModal,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { formatTradeDecimal, isTradeDecimalString } from "../../trade-validation";
import { PRICE_ENTRIES_MAX, PROMOTIONS_MAX, PROMOTION_BENEFIT_TYPES } from "../pricing-contract";
import {
  EMPTY_PRICE_ENTRY_DRAFT,
  EMPTY_PROMOTION_DRAFT,
  EMPTY_VERSION_DRAFT,
  detectVersionDraftConflicts,
  type PriceEntryDraft,
  type PromotionDraft,
  type VersionDraft,
} from "../version-draft";

interface CreateVersionDrawerProps {
  bookCode: string;
  defaultCurrencyCode?: string;
  onClose: () => void;
  onSubmit: (draft: VersionDraft) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateVersionDrawer({
  bookCode,
  defaultCurrencyCode = "",
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateVersionDrawerProps) {
  const { t } = useI18n();
  const initialDraft = useMemo<VersionDraft>(
    () => ({
      ...EMPTY_VERSION_DRAFT,
      entries: [
        {
          ...EMPTY_PRICE_ENTRY_DRAFT,
          currencyCode: defaultCurrencyCode || EMPTY_PRICE_ENTRY_DRAFT.currencyCode,
        },
      ],
    }),
    [defaultCurrencyCode],
  );
  const [draft, setDraft] = useState<VersionDraft>(initialDraft);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const conflictReport = useMemo(
    () => detectVersionDraftConflicts(draft, defaultCurrencyCode),
    [draft, defaultCurrencyCode],
  );

  const conflictMessages = useMemo<string[]>(() => {
    const msgs: string[] = [];
    for (const idx of conflictReport.floorAboveUnitIndices) {
      const entry = draft.entries[idx];
      msgs.push(
        formatTemplate(t.tradePricing.conflictFloorAboveUnit, {
          index: idx + 1,
          floor: entry?.minimumAllowedPrice ?? "",
          unit: entry?.unitPrice ?? "",
        }),
      );
    }
    for (const idx of conflictReport.invalidQtyRangeIndices) {
      const entry = draft.entries[idx];
      msgs.push(
        formatTemplate(t.tradePricing.conflictMinAboveMax, {
          index: idx + 1,
          min: entry?.minimumQuantity ?? "",
          max: entry?.maximumQuantity ?? "",
        }),
      );
    }
    for (const pair of conflictReport.overlappingTierPairs) {
      msgs.push(
        formatTemplate(t.tradePricing.conflictTierOverlap, {
          first: pair.firstIndex + 1,
          second: pair.secondIndex + 1,
        }),
      );
    }
    for (const idx of conflictReport.percentageOver100PromotionIndices) {
      const promo = draft.promotions[idx];
      msgs.push(
        formatTemplate(t.tradePricing.conflictPercentOver100, {
          index: idx + 1,
          value: promo?.discountValue ?? "",
        }),
      );
    }
    return msgs;
  }, [conflictReport, draft.entries, draft.promotions, t.tradePricing]);

  const patchEntry = (index: number, patch: Partial<PriceEntryDraft>) =>
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    }));

  const duplicateEntry = (index: number) =>
    setDraft((current) => {
      if (current.entries.length >= PRICE_ENTRIES_MAX) return current;
      const source = current.entries[index];
      const nextEntries = [...current.entries];
      nextEntries.splice(index + 1, 0, { ...source });
      return { ...current, entries: nextEntries };
    });

  const removeEntryAt = (index: number) =>
    setDraft((current) => {
      if (current.entries.length <= 1) return current;
      return {
        ...current,
        entries: current.entries.filter((_, position) => position !== index),
      };
    });

  const patchPromotion = (index: number, patch: Partial<PromotionDraft>) =>
    setDraft((current) => ({
      ...current,
      promotions: current.promotions.map((promotion, position) =>
        position === index ? { ...promotion, ...patch } : promotion,
      ),
    }));

  const removePromotionAt = (index: number) =>
    setDraft((current) => ({
      ...current,
      promotions: current.promotions.filter((_, position) => position !== index),
    }));

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="full"
      title={`${t.tradePricing.versionCreateTitle} · ${bookCode}`}
      description={t.tradePricing.versionCreateDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
          )}
        >
          <Layers className="size-4" aria-hidden="true" />
        </div>
      }
      titleBadge={
        <div className="flex items-center gap-1.5">
          <Badge tone="brand">{`${draft.entries.length} ${t.tradePricing.entries}`}</Badge>
          <Badge tone="neutral">{`${draft.promotions.length} ${t.tradePricing.promotions}`}</Badge>
        </div>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(draft)}
      error={error ?? undefined}
      asideSlot={
        <div className="flex flex-col gap-3 p-4">
          <div
            className={cn(
              "rounded-lg border p-3.5",
              conflictMessages.length === 0
                ? SWATCH_SURFACE_PALETTES.green.sectionCard
                : SWATCH_SURFACE_PALETTES.red.sectionCard,
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                {conflictMessages.length === 0 ? (
                  <CheckCircle2
                    className={cn("size-4", SWATCH_SURFACE_PALETTES.green.iconText)}
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldAlert
                    className={cn("size-4", SWATCH_SURFACE_PALETTES.red.iconText)}
                    aria-hidden="true"
                  />
                )}
                {t.tradePricing.conflictRadarTitle}
              </span>
              <Badge tone={conflictMessages.length === 0 ? "positive" : "negative"}>
                {String(conflictMessages.length)}
              </Badge>
            </div>
            {conflictMessages.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t.tradePricing.conflictRadarClean}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-xs text-foreground">
                {conflictMessages.map((msg, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-1.5 rounded-md border border-border bg-card p-2"
                  >
                    <AlertTriangle
                      className={cn("mt-0.5 size-3.5 shrink-0", SWATCH_SURFACE_PALETTES.red.iconText)}
                      aria-hidden="true"
                    />
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className={cn(
              "rounded-lg border p-3.5",
              SWATCH_SURFACE_PALETTES.purple.sectionCard,
            )}
          >
            <span className="text-xs font-semibold text-foreground">
              {t.tradePricing.makerCheckerCardTitle}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.tradePricing.makerCheckerCardDesc}
            </p>
          </div>
        </div>
      }
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradePricing.versionCreateTitle,
        sectionInvalid: t.tradeCommon.actionFailed,
      }}
    >
      <div className="flex flex-col gap-5">
        {/* Effective Window */}
        <div
          className={cn(
            "grid gap-3 rounded-lg border p-4 md:grid-cols-2",
            SWATCH_SURFACE_PALETTES.indigo.sectionCard,
          )}
        >
          <Field
            label={t.tradePricing.effectiveFrom}
            hint={t.tradePricing.guideEffectiveFrom}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Input
              size="sm"
              placeholder={t.tradePricing.effectiveFrom}
              type="datetime-local"
              value={draft.effectiveFrom}
              disabled={isSubmitting}
              onChange={(event) =>
                setDraft((current) => ({ ...current, effectiveFrom: event.target.value }))
              }
            />
          </Field>
          <Field
            label={t.tradePricing.effectiveTo}
            hint={t.tradePricing.guideEffectiveTo}
            showLabel
            hintPlacement="tooltip"
          >
            <Input
              size="sm"
              placeholder={t.tradePricing.effectiveTo}
              type="datetime-local"
              value={draft.effectiveTo}
              disabled={isSubmitting}
              onChange={(event) =>
                setDraft((current) => ({ ...current, effectiveTo: event.target.value }))
              }
            />
          </Field>
        </div>

        {/* Price Entries Section */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border",
                  SWATCH_SURFACE_PALETTES.blue.iconBoxIdle,
                )}
              >
                <Layers className="size-3.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {t.tradePricing.entries}
              </span>
              <Badge tone="brand">{String(draft.entries.length)}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isSubmitting || draft.entries.length >= PRICE_ENTRIES_MAX}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    entries: [
                      ...current.entries,
                      {
                        ...EMPTY_PRICE_ENTRY_DRAFT,
                        currencyCode:
                          defaultCurrencyCode ||
                          current.entries[current.entries.length - 1]?.currencyCode ||
                          "",
                      },
                    ],
                  }))
                }
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tradePricing.addEntry}
              </Button>
              {draft.entries.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isSubmitting}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      entries: current.entries.slice(0, -1),
                    }))
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t.tradePricing.removeEntry}
                </Button>
              )}
            </div>
          </div>

          {draft.entries.map((entry, index) => {
            const hasEntryConflict =
              conflictReport.floorAboveUnitIndices.includes(index) ||
              conflictReport.invalidQtyRangeIndices.includes(index) ||
              conflictReport.currencyMismatchIndices.includes(index) ||
              conflictReport.overlappingTierPairs.some(
                (p) => p.firstIndex === index || p.secondIndex === index,
              );
            return (
              <div
                key={index}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border border-s-4 bg-card p-3.5",
                  hasEntryConflict
                    ? SWATCH_SURFACE_PALETTES.red.accentBorder
                    : SWATCH_SURFACE_PALETTES.blue.accentBorder,
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <IdentifierText className="text-xs font-semibold text-foreground">
                      {`#${index + 1}`}
                    </IdentifierText>
                    {entry.minimumAllowedPrice.trim() ? (
                      <Badge tone="caution">{t.tradePricing.minimumAllowedPrice}</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={isSubmitting || draft.entries.length >= PRICE_ENTRIES_MAX}
                      onClick={() => duplicateEntry(index)}
                    >
                      <Copy className="size-3.5" aria-hidden="true" />
                      {t.tradePricing.cloneEntry}
                    </Button>
                    {draft.entries.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={isSubmitting}
                        onClick={() => removeEntryAt(index)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        {t.tradePricing.deleteRow}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <Field label={t.tradePricing.itemId} showLabel required>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono"
                      placeholder={t.tradePricing.itemId}
                      value={entry.itemId}
                      disabled={isSubmitting}
                      onChange={(event) => patchEntry(index, { itemId: event.target.value })}
                    />
                  </Field>
                  <Field label={t.tradePricing.uomId} showLabel required>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono"
                      placeholder={t.tradePricing.uomId}
                      value={entry.uomId}
                      disabled={isSubmitting}
                      onChange={(event) => patchEntry(index, { uomId: event.target.value })}
                    />
                  </Field>
                  <Field label={t.tradePricing.currencyCode} showLabel required>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono uppercase"
                      placeholder={t.tradePricing.currencyCode}
                      value={entry.currencyCode}
                      maxLength={3}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        patchEntry(index, { currencyCode: event.target.value.toUpperCase() })
                      }
                    />
                  </Field>
                  <Field
                    label={t.tradePricing.unitPrice}
                    hint={t.tradeCommon.decimalHint}
                    showLabel
                    hintPlacement="tooltip"
                    required
                  >
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono tabular-nums"
                      placeholder={t.tradePricing.unitPrice}
                      value={entry.unitPrice}
                      inputMode="decimal"
                      disabled={isSubmitting}
                      onChange={(event) => patchEntry(index, { unitPrice: event.target.value })}
                      onBlur={() => {
                        if (
                          entry.unitPrice.trim() &&
                          isTradeDecimalString(entry.unitPrice.trim())
                        ) {
                          patchEntry(index, { unitPrice: formatTradeDecimal(entry.unitPrice) });
                        }
                      }}
                    />
                  </Field>
                  <Field label={t.tradePricing.minimumQuantity} showLabel required>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono tabular-nums"
                      placeholder={t.tradePricing.minimumQuantity}
                      value={entry.minimumQuantity}
                      inputMode="decimal"
                      disabled={isSubmitting}
                      onChange={(event) =>
                        patchEntry(index, { minimumQuantity: event.target.value })
                      }
                      onBlur={() => {
                        if (
                          entry.minimumQuantity.trim() &&
                          isTradeDecimalString(entry.minimumQuantity.trim())
                        ) {
                          patchEntry(index, {
                            minimumQuantity: formatTradeDecimal(entry.minimumQuantity),
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field label={t.tradePricing.maximumQuantity} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono tabular-nums"
                      placeholder={t.tradePricing.maximumQuantity}
                      value={entry.maximumQuantity}
                      inputMode="decimal"
                      disabled={isSubmitting}
                      onChange={(event) =>
                        patchEntry(index, { maximumQuantity: event.target.value })
                      }
                      onBlur={() => {
                        if (
                          entry.maximumQuantity.trim() &&
                          isTradeDecimalString(entry.maximumQuantity.trim())
                        ) {
                          patchEntry(index, {
                            maximumQuantity: formatTradeDecimal(entry.maximumQuantity),
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label={t.tradePricing.minimumAllowedPrice}
                    hint={t.tradePricing.guideMinimumAllowedPrice}
                    showLabel
                    hintPlacement="tooltip"
                  >
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono tabular-nums"
                      placeholder={t.tradePricing.minimumAllowedPrice}
                      value={entry.minimumAllowedPrice}
                      inputMode="decimal"
                      disabled={isSubmitting}
                      onChange={(event) =>
                        patchEntry(index, { minimumAllowedPrice: event.target.value })
                      }
                      onBlur={() => {
                        if (
                          entry.minimumAllowedPrice.trim() &&
                          isTradeDecimalString(entry.minimumAllowedPrice.trim())
                        ) {
                          patchEntry(index, {
                            minimumAllowedPrice: formatTradeDecimal(entry.minimumAllowedPrice),
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label={t.tradePricing.priority}
                    hint={t.tradePricing.priorityHint}
                    showLabel
                    hintPlacement="tooltip"
                  >
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono tabular-nums"
                      placeholder={t.tradePricing.priority}
                      type="number"
                      min={0}
                      max={10000}
                      value={entry.priority}
                      disabled={isSubmitting}
                      onChange={(event) => patchEntry(index, { priority: event.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>

        {/* Promotions Section */}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border",
                  SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
                )}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {t.tradePricing.promotions}
              </span>
              <Badge tone="neutral">{String(draft.promotions.length)}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isSubmitting || draft.promotions.length >= PROMOTIONS_MAX}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    promotions: [...current.promotions, EMPTY_PROMOTION_DRAFT],
                  }))
                }
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tradePricing.addPromotion}
              </Button>
              {draft.promotions.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isSubmitting}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      promotions: current.promotions.slice(0, -1),
                    }))
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t.tradePricing.removePromotion}
                </Button>
              )}
            </div>
          </div>

          {draft.promotions.map((promotion, index) => (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-3 rounded-lg border border-s-4 bg-card p-3.5",
                SWATCH_SURFACE_PALETTES.purple.accentBorder,
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <IdentifierText className="text-xs font-semibold text-foreground">
                    {promotion.code.trim() || `PROMO-${index + 1}`}
                  </IdentifierText>
                  <Badge tone={promotion.exclusive ? "caution" : "brand"}>
                    {tradeStatusLabel(t.tradeStatus, promotion.benefitType, t.common.unknownCode)}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isSubmitting}
                  onClick={() => removePromotionAt(index)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t.tradePricing.deleteRow}
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Field label={t.tradePricing.promotionCode} showLabel required>
                  <Input
                    size="sm"
                    dir="ltr"
                    className="font-mono"
                    placeholder={t.tradePricing.promotionCode}
                    value={promotion.code}
                    disabled={isSubmitting}
                    onChange={(event) => patchPromotion(index, { code: event.target.value })}
                  />
                </Field>
                <Field label={t.tradePricing.promotionName} showLabel required>
                  <Input
                    size="sm"
                    placeholder={t.tradePricing.promotionName}
                    value={promotion.name}
                    disabled={isSubmitting}
                    onChange={(event) => patchPromotion(index, { name: event.target.value })}
                  />
                </Field>
                <Field label={t.tradePricing.benefitType} showLabel required>
                  <Select
                    value={promotion.benefitType}
                    disabled={isSubmitting}
                    onValueChange={(next) =>
                      patchPromotion(index, {
                        benefitType: next as PromotionDraft["benefitType"],
                      })
                    }
                  >
                    <SelectTrigger size="sm" aria-label={t.tradePricing.benefitType}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMOTION_BENEFIT_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={t.tradePricing.discountValue}
                  hint={t.tradeCommon.decimalHint}
                  showLabel
                  hintPlacement="tooltip"
                  required
                >
                  <Input
                    size="sm"
                    dir="ltr"
                    className="font-mono tabular-nums"
                    placeholder={t.tradePricing.discountValue}
                    value={promotion.discountValue}
                    inputMode="decimal"
                    disabled={isSubmitting}
                    onChange={(event) =>
                      patchPromotion(index, { discountValue: event.target.value })
                    }
                    onBlur={() => {
                      if (
                        promotion.discountValue.trim() &&
                        isTradeDecimalString(promotion.discountValue.trim())
                      ) {
                        patchPromotion(index, {
                          discountValue: formatTradeDecimal(promotion.discountValue),
                        });
                      }
                    }}
                  />
                </Field>
                <Field
                  label={t.tradePricing.stackGroup}
                  hint={t.tradePricing.guideStackGroup}
                  showLabel
                  hintPlacement="tooltip"
                >
                  <Input
                    size="sm"
                    dir="ltr"
                    className="font-mono"
                    placeholder={t.tradePricing.stackGroup}
                    value={promotion.stackGroup}
                    disabled={isSubmitting}
                    onChange={(event) => patchPromotion(index, { stackGroup: event.target.value })}
                  />
                </Field>
                <Field
                  label={t.tradePricing.exclusive}
                  hint={t.tradePricing.guideExclusive}
                  showLabel
                  hintPlacement="tooltip"
                >
                  <Switch
                    checked={promotion.exclusive}
                    disabled={isSubmitting}
                    onCheckedChange={(checked) => patchPromotion(index, { exclusive: checked })}
                  />
                </Field>
              </div>

              {/* Optional Promotion Target Selectors */}
              <div className="rounded-md border border-border bg-muted/25 p-2.5">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  {t.tradePricing.promoScopeSelectors}
                </p>
                <div className="grid gap-2.5 md:grid-cols-4">
                  <Field label={t.tradePricing.itemId} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono"
                      placeholder={t.tradePricing.optionalHint}
                      value={promotion.itemId ?? ""}
                      disabled={isSubmitting}
                      onChange={(e) => patchPromotion(index, { itemId: e.target.value })}
                    />
                  </Field>
                  <Field label={t.tradePricing.uomId} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono"
                      placeholder={t.tradePricing.optionalHint}
                      value={promotion.uomId ?? ""}
                      disabled={isSubmitting}
                      onChange={(e) => patchPromotion(index, { uomId: e.target.value })}
                    />
                  </Field>
                  <Field label={t.tradePricing.partyId} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono"
                      placeholder={t.tradePricing.optionalHint}
                      value={promotion.partyId ?? ""}
                      disabled={isSubmitting}
                      onChange={(e) => patchPromotion(index, { partyId: e.target.value })}
                    />
                  </Field>
                  <Field label={t.tradePricing.minimumQuantity} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono tabular-nums"
                      placeholder={t.tradePricing.optionalHint}
                      value={promotion.minimumQuantity ?? ""}
                      disabled={isSubmitting}
                      onChange={(e) => patchPromotion(index, { minimumQuantity: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FormModal>
  );
}
