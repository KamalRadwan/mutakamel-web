"use client";

import { useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  FormModal,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ITEM_CODE_MAX_LENGTH,
  ITEM_LOCALIZED_NAME_MAX_LENGTH,
  ITEM_KINDS,
  ITEM_STATUSES,
  parseVariantIdentityToRows,
  serializeVariantRows,
  toItemForm,
  type Item,
  type ItemFormValues,
  type ItemKind,
  type ItemStatus,
  type VariantAttributeRow,
} from "../item-contract";
import { ItemExtendedFields } from "./ItemExtendedFields";
import { ItemRelationsFields } from "./ItemRelationsFields";
import { useActiveUoms } from "../hooks/useActiveUoms";
import { tradeLocalizedName } from "../../trade-validation";
import { CategoryPicker } from "../../categories/components/CategoryPicker";
import type { ItemCategorySummary } from "../../categories/category-contract";
import type { ItemImageChange } from "../item-image-contract";
import { ItemImageManager } from "./ItemImageManager";

interface ItemDrawerProps {
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ItemFormValues) => Promise<boolean>;
}

function useDrawerLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
    sections: t.trade.itemFormSections,
    sectionInvalid: t.trade.itemFormHasErrors,
  };
}

function EditItemFields({
  values,
  onChange,
  isSubmitting,
  itemId,
  categorySummary,
}: {
  values: ItemFormValues;
  onChange: (patch: Partial<ItemFormValues>) => void;
  isSubmitting: boolean;
  itemId: string;
  categorySummary: ItemCategorySummary | null;
}) {
  const { t, lang } = useI18n();
  const { options: activeUoms, all: allUoms } = useActiveUoms(true, values.baseUomId);
  const resolvedBaseUom = (allUoms ?? activeUoms).find((uom) => uom.id === values.baseUomId);
  const resolvedBaseUomDisplay = resolvedBaseUom
    ? `${resolvedBaseUom.code} — ${tradeLocalizedName(resolvedBaseUom.localizedNames, lang) || resolvedBaseUom.displayName}`
    : values.baseUomId;
  const initialParsed = parseVariantIdentityToRows(values.variantIdentity, 1);
  const [variantRows, setVariantRows] = useState<VariantAttributeRow[]>(initialParsed.rows);
  const [nextRowId, setNextRowId] = useState<number>(initialParsed.nextRowId);

  const syncVariantRows = (nextRows: VariantAttributeRow[]) => {
    setVariantRows(nextRows);
    const serialized = serializeVariantRows(nextRows);
    onChange({
      variantIdentity: serialized.invalid ? "{invalid}" : serialized.json,
    });
  };

  const addVariantRow = () => {
    setVariantRows((current) => [
      ...current,
      { id: `attribute-${nextRowId}`, name: "", value: "" },
    ]);
    setNextRowId((current) => current + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">
          <Field label={t.trade.itemCode} hint={t.trade.itemCodeHint} readOnly showLabel>
            <Input
              size="md"
              placeholder={t.trade.itemCode}
              dir="ltr"
              className="font-mono"
              value={values.canonicalCode}
              onChange={(event) => onChange({ canonicalCode: event.target.value.toUpperCase() })}
              maxLength={ITEM_CODE_MAX_LENGTH}
              disabled={isSubmitting}
              readOnly
            />
          </Field>

          {/* `UpdateItemDto` has no `itemKind` or `baseUomId`: they are set once. */}
          <Field label={t.trade.itemKind} readOnly required showLabel>
            <Select
              value={values.itemKind}
              onValueChange={(next) => onChange({ itemKind: next as ItemKind })}
              disabled
            >
              <SelectTrigger size="md" aria-label={t.trade.itemKind} aria-readonly>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t.trade[`itemKind_${kind}`]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.trade.itemBaseUom} hint={t.trade.itemBaseUomHint} readOnly showLabel>
            <Input
              size="md"
              placeholder={t.trade.itemBaseUom}
              value={resolvedBaseUomDisplay}
              disabled={isSubmitting}
              readOnly
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
          <Field label={t.trade.nameEn} showLabel>
            <Input
              size="md"
              placeholder={t.trade.nameEn}
              dir="ltr"
              value={values.nameEn}
              onChange={(event) => onChange({ nameEn: event.target.value })}
              maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </Field>

          <Field label={t.trade.nameAr} hint={t.trade.localizedNamesHint} showLabel>
            <Input
              size="md"
              placeholder={t.trade.nameAr}
              value={values.nameAr}
              onChange={(event) => onChange({ nameAr: event.target.value })}
              maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
          <CategoryPicker
            value={values.category}
            currentSummary={categorySummary}
            onChange={(category) => onChange({ category })}
            disabled={isSubmitting}
          />

          <Field label={t.common.status} showLabel>
            <Select
              value={values.status}
              onValueChange={(next) => onChange({ status: next as ItemStatus })}
              disabled={isSubmitting}
            >
              <SelectTrigger size="md" aria-label={t.common.status}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t.trade[`itemStatus_${status}`]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t.trade.itemVariantAttributes}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={isSubmitting}
              onClick={addVariantRow}
            >
              <Plus className="size-3.5" aria-hidden />
              {t.trade.itemAddAttribute}
            </Button>
          </div>

          {variantRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.trade.itemVariantHint}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {variantRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                >
                  <Field label={t.trade.itemAttributeName} showLabel>
                    <Input
                      size="md"
                      placeholder={t.trade.itemAttributeName}
                      dir="ltr"
                      className="font-mono"
                      value={row.name}
                      onChange={(event) =>
                        syncVariantRows(
                          variantRows.map((itemRow) =>
                            itemRow.id === row.id
                              ? { ...itemRow, name: event.target.value }
                              : itemRow,
                          ),
                        )
                      }
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Field label={t.trade.itemAttributeValue} showLabel>
                    <Input
                      size="md"
                      placeholder={t.trade.itemAttributeValue}
                      value={row.value}
                      onChange={(event) =>
                        syncVariantRows(
                          variantRows.map((itemRow) =>
                            itemRow.id === row.id
                              ? { ...itemRow, value: event.target.value }
                              : itemRow,
                          ),
                        )
                      }
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    aria-label={t.trade.itemRemoveAttribute}
                    onClick={() =>
                      syncVariantRows(variantRows.filter((itemRow) => itemRow.id !== row.id))
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
        <ItemRelationsFields
          values={values}
          disabled={isSubmitting}
          excludeItemId={itemId}
          onChange={onChange}
        />

        <ItemExtendedFields
          values={values}
          disabled={isSubmitting}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

interface EditItemDrawerProps extends ItemDrawerProps {
  item: Item;
  /** The image is its own command; Save never sends it (LLD 02b §19 Edit flow). */
  onImageChanged: (change: ItemImageChange) => void;
  onImageStale: () => void;
}

export function EditItemDrawer({
  item,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  onImageChanged,
  onImageStale,
}: EditItemDrawerProps) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = toItemForm(item);
  const [values, setValues] = useState<ItemFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.itemEditTitle}
      description={t.trade.itemEditDescription}
      size="wide"
      headerIcon={
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border border-border ${
            values.itemKind === "SERVICE"
              ? "bg-selected text-selected-foreground"
              : values.itemKind === "COMBO"
                ? "bg-warning-subtle text-warning-subtle-foreground"
                : "bg-info-subtle text-info-subtle-foreground"
          }`}
        >
          <Package className="size-4" aria-hidden />
        </div>
      }
      titleBadge={
        <div className="flex items-center gap-1.5">
          <Badge tone="brand">
            <IdentifierText>{item.canonicalCode}</IdentifierText>
          </Badge>
          <Badge
            tone={
              values.status === "ACTIVE"
                ? "positive"
                : values.status === "DRAFT"
                  ? "caution"
                  : values.status === "DISCONTINUED"
                    ? "negative"
                    : "neutral"
            }
          >
            {t.trade[`itemStatus_${values.status}`]}
          </Badge>
        </div>
      }
      bodyClassName="bg-muted/40 p-4 sm:p-5"
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="mb-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
        <ItemImageManager
          item={item}
          size="md"
          onChanged={onImageChanged}
          onStale={onImageStale}
        />
      </div>
      <EditItemFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        itemId={item.id}
        categorySummary={item.categorySummary}
      />
    </FormModal>
  );
}

