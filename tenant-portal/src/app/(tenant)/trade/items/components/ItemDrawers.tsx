"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ITEM_CODE_MAX_LENGTH,
  ITEM_LOCALIZED_NAME_MAX_LENGTH,
  ITEM_KINDS,
  ITEM_STATUSES,
  toItemForm,
  type Item,
  type ItemFormValues,
  type ItemKind,
  type ItemStatus,
} from "../item-contract";
import { ItemExtendedFields } from "./ItemExtendedFields";
import { ItemRelationsFields } from "./ItemRelationsFields";
import { CategoryPicker } from "../../categories/components/CategoryPicker";
import type { ItemCategorySummary } from "../../categories/category-contract";

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
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.trade.itemCode}
        hint={t.trade.itemCodeHint}
        readOnly
      >
        <Input size="sm" placeholder={t.trade.itemCode}
          dir="ltr"
          value={values.canonicalCode}
          onChange={(event) => onChange({ canonicalCode: event.target.value.toUpperCase() })}
          maxLength={ITEM_CODE_MAX_LENGTH}
          disabled={isSubmitting}
          readOnly
        />
      </Field>

      {/* `UpdateItemDto` has no `itemKind` or `baseUomId`: they are set once. */}
      <Field label={t.trade.itemKind} readOnly required>
        <Select
          value={values.itemKind}
          onValueChange={(next) => onChange({ itemKind: next as ItemKind })}
          disabled
        >
          <SelectTrigger size="sm" aria-label={t.trade.itemKind} aria-readonly>
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

      <Field label={t.trade.nameAr} hint={t.trade.localizedNamesHint}>
        <Input size="sm" placeholder={t.trade.nameAr}
          value={values.nameAr}
          onChange={(event) => onChange({ nameAr: event.target.value })}
          maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.nameEn}>
        <Input size="sm" placeholder={t.trade.nameEn}
          dir="ltr"
          value={values.nameEn}
          onChange={(event) => onChange({ nameEn: event.target.value })}
          maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field
        label={t.trade.itemBaseUom}
        hint={t.trade.itemBaseUomHint}
        readOnly
      >
        <Input size="sm" placeholder={t.trade.itemBaseUom}
          dir="ltr"
          className="font-mono"
          value={values.baseUomId}
          onChange={(event) => onChange({ baseUomId: event.target.value })}
          disabled={isSubmitting}
          readOnly
        />
      </Field>

      <CategoryPicker value={values.category} currentSummary={categorySummary}
        onChange={(category) => onChange({ category })} disabled={isSubmitting} />

      <Field label={t.trade.itemVariantIdentity} hint={t.trade.itemVariantHint}>
        <Textarea placeholder={t.trade.itemVariantIdentity}
          dir="ltr"
          className="font-mono"
          value={values.variantIdentity}
          onChange={(event) => onChange({ variantIdentity: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.common.status}>
        <Select
          value={values.status}
          onValueChange={(next) => onChange({ status: next as ItemStatus })}
          disabled={isSubmitting}
        >
          <SelectTrigger size="sm" aria-label={t.common.status}>
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
  );
}

export function EditItemDrawer({
  item,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ItemDrawerProps & { item: Item }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = toItemForm(item);
  const [values, setValues] = useState<ItemFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.itemEditTitle}
      description={t.trade.itemEditDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <EditItemFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        itemId={item.id}
        categorySummary={item.categorySummary}
      />
    </FormDrawer>
  );
}
