"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { PRICE_ENTRIES_MAX, PROMOTIONS_MAX, PROMOTION_BENEFIT_TYPES } from "../pricing-contract";
import {
  EMPTY_PRICE_ENTRY_DRAFT,
  EMPTY_PROMOTION_DRAFT,
  EMPTY_VERSION_DRAFT,
  type PriceEntryDraft,
  type PromotionDraft,
  type VersionDraft,
} from "../version-draft";

interface CreateVersionDrawerProps {
  bookCode: string;
  onClose: () => void;
  onSubmit: (draft: VersionDraft) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * The price-book version editor.
 *
 * `entries` is required and must hold at least one row — a version cannot be
 * created empty — while `promotions` defaults to `[]`. Every money and
 * quantity field stays a string end to end.
 */
export function CreateVersionDrawer({
  bookCode,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateVersionDrawerProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<VersionDraft>(EMPTY_VERSION_DRAFT);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(EMPTY_VERSION_DRAFT);

  const patchEntry = (index: number, patch: Partial<PriceEntryDraft>) =>
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    }));

  const patchPromotion = (index: number, patch: Partial<PromotionDraft>) =>
    setDraft((current) => ({
      ...current,
      promotions: current.promotions.map((promotion, position) =>
        position === index ? { ...promotion, ...patch } : promotion,
      ),
    }));

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${t.tradePricing.versionCreateTitle} · ${bookCode}`}
      description={t.tradePricing.versionCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(draft)}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t.tradePricing.effectiveFrom} required>
            <Input
              type="datetime-local"
              value={draft.effectiveFrom}
              disabled={isSubmitting}
              onChange={(event) =>
                setDraft((current) => ({ ...current, effectiveFrom: event.target.value }))
              }
            />
          </Field>
          <Field label={t.tradePricing.effectiveTo} hint={t.tradePricing.effectiveToHint}>
            <Input
              type="datetime-local"
              value={draft.effectiveTo}
              disabled={isSubmitting}
              onChange={(event) =>
                setDraft((current) => ({ ...current, effectiveTo: event.target.value }))
              }
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">{t.tradePricing.entries}</p>
          {draft.entries.map((entry, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-4">
              <Field label={t.tradePricing.itemId} required>
                <Input
                  value={entry.itemId}
                  disabled={isSubmitting}
                  onChange={(event) => patchEntry(index, { itemId: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.uomId} required>
                <Input
                  value={entry.uomId}
                  disabled={isSubmitting}
                  onChange={(event) => patchEntry(index, { uomId: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.currencyCode} required>
                <Input
                  value={entry.currencyCode}
                  maxLength={3}
                  disabled={isSubmitting}
                  onChange={(event) => patchEntry(index, { currencyCode: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.unitPrice} required hint={t.tradeCommon.decimalHint}>
                <Input
                  value={entry.unitPrice}
                  inputMode="decimal"
                  disabled={isSubmitting}
                  onChange={(event) => patchEntry(index, { unitPrice: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.minimumQuantity} required>
                <Input
                  value={entry.minimumQuantity}
                  inputMode="decimal"
                  disabled={isSubmitting}
                  onChange={(event) => patchEntry(index, { minimumQuantity: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.maximumQuantity}>
                <Input
                  value={entry.maximumQuantity}
                  inputMode="decimal"
                  disabled={isSubmitting}
                  onChange={(event) => patchEntry(index, { maximumQuantity: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.minimumAllowedPrice}>
                <Input
                  value={entry.minimumAllowedPrice}
                  inputMode="decimal"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    patchEntry(index, { minimumAllowedPrice: event.target.value })
                  }
                />
              </Field>
              <Field label={t.tradePricing.priority} hint={t.tradePricing.priorityHint}>
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  value={entry.priority}
                  disabled={isSubmitting}
                  onChange={(event) => patchEntry(index, { priority: event.target.value })}
                />
              </Field>
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting || draft.entries.length >= PRICE_ENTRIES_MAX}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  entries: [...current.entries, EMPTY_PRICE_ENTRY_DRAFT],
                }))
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              {t.tradePricing.addEntry}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting || draft.entries.length <= 1}
              onClick={() =>
                setDraft((current) => ({ ...current, entries: current.entries.slice(0, -1) }))
              }
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t.tradePricing.removeEntry}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">{t.tradePricing.promotions}</p>
          {draft.promotions.map((promotion, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-3">
              <Field label={t.tradePricing.promotionCode} required>
                <Input
                  value={promotion.code}
                  disabled={isSubmitting}
                  onChange={(event) => patchPromotion(index, { code: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.promotionName} required>
                <Input
                  value={promotion.name}
                  disabled={isSubmitting}
                  onChange={(event) => patchPromotion(index, { name: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.benefitType} required>
                <Select
                  value={promotion.benefitType}
                  disabled={isSubmitting}
                  onValueChange={(next) =>
                    patchPromotion(index, {
                      benefitType: next as PromotionDraft["benefitType"],
                    })
                  }
                >
                  <SelectTrigger aria-label={t.tradePricing.benefitType}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMOTION_BENEFIT_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tradeStatusLabel(t.tradeStatus, value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t.tradePricing.discountValue} required hint={t.tradeCommon.decimalHint}>
                <Input
                  value={promotion.discountValue}
                  inputMode="decimal"
                  disabled={isSubmitting}
                  onChange={(event) => patchPromotion(index, { discountValue: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.stackGroup}>
                <Input
                  value={promotion.stackGroup}
                  disabled={isSubmitting}
                  onChange={(event) => patchPromotion(index, { stackGroup: event.target.value })}
                />
              </Field>
              <Field label={t.tradePricing.exclusive}>
                <Switch
                  checked={promotion.exclusive}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => patchPromotion(index, { exclusive: checked })}
                />
              </Field>
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting || draft.promotions.length >= PROMOTIONS_MAX}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  promotions: [...current.promotions, EMPTY_PROMOTION_DRAFT],
                }))
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              {t.tradePricing.addPromotion}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting || draft.promotions.length === 0}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  promotions: current.promotions.slice(0, -1),
                }))
              }
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t.tradePricing.removePromotion}
            </Button>
          </div>
        </div>
      </div>
    </FormDrawer>
  );
}
