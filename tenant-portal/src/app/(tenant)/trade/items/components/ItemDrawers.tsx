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
  EMPTY_ITEM_FORM,
  ITEM_CODE_MAX_LENGTH,
  ITEM_KINDS,
  ITEM_STATUSES,
  toItemForm,
  type Item,
  type ItemFormValues,
  type ItemKind,
  type ItemStatus,
} from "../item-contract";
import { LOCALIZED_NAME_MAX_LENGTH } from "../../trade-validation";

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

function ItemFields({
  values,
  onChange,
  isSubmitting,
  isEdit,
}: {
  values: ItemFormValues;
  onChange: (patch: Partial<ItemFormValues>) => void;
  isSubmitting: boolean;
  isEdit: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.trade.itemCode}
        hint={t.trade.itemCodeHint}
        readOnly={isEdit}
        required={!isEdit}
      >
        <Input
          dir="ltr"
          value={values.canonicalCode}
          onChange={(event) => onChange({ canonicalCode: event.target.value.toUpperCase() })}
          maxLength={ITEM_CODE_MAX_LENGTH}
          disabled={isSubmitting}
          readOnly={isEdit}
          required={!isEdit}
        />
      </Field>

      {/* `UpdateItemDto` has no `itemKind` or `baseUomId`: they are set once. */}
      <Field label={t.trade.itemKind} readOnly={isEdit} required>
        <Select
          value={values.itemKind}
          onValueChange={(next) => onChange({ itemKind: next as ItemKind })}
          disabled={isSubmitting || isEdit}
        >
          <SelectTrigger aria-label={t.trade.itemKind} aria-readonly={isEdit}>
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
        <Input
          value={values.nameAr}
          onChange={(event) => onChange({ nameAr: event.target.value })}
          maxLength={LOCALIZED_NAME_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.nameEn}>
        <Input
          dir="ltr"
          value={values.nameEn}
          onChange={(event) => onChange({ nameEn: event.target.value })}
          maxLength={LOCALIZED_NAME_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field
        label={t.trade.itemBaseUom}
        hint={t.trade.itemBaseUomHint}
        readOnly={isEdit}
        required={!isEdit}
      >
        <Input
          dir="ltr"
          className="font-mono"
          value={values.baseUomId}
          onChange={(event) => onChange({ baseUomId: event.target.value })}
          disabled={isSubmitting}
          readOnly={isEdit}
          required={!isEdit}
        />
      </Field>

      <Field label={t.trade.itemCategory}>
        <Input
          dir="ltr"
          className="font-mono"
          value={values.categoryId}
          onChange={(event) => onChange({ categoryId: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.itemVariantIdentity} hint={t.trade.itemVariantHint}>
        <Textarea
          dir="ltr"
          className="font-mono"
          value={values.variantIdentity}
          onChange={(event) => onChange({ variantIdentity: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>

      {isEdit ? (
        <Field label={t.common.status}>
          <Select
            value={values.status}
            onValueChange={(next) => onChange({ status: next as ItemStatus })}
            disabled={isSubmitting}
          >
            <SelectTrigger aria-label={t.common.status}>
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
      ) : null}
    </div>
  );
}

export function CreateItemDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ItemDrawerProps & { isOpen: boolean }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_ITEM_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_ITEM_FORM);
          onClose();
        }
      }}
      title={t.trade.itemCreateTitle}
      description={t.trade.itemCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_ITEM_FORM);
        });
      }}
      error={error ?? undefined}
      labels={labels}
    >
      <ItemFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit={false}
      />
    </FormDrawer>
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
      <ItemFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit
      />
    </FormDrawer>
  );
}
