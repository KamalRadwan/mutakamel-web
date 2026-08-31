"use client";

import { useState } from "react";
import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  EMPTY_UOM_CONVERSION_FORM,
  type UomConversionFormValues,
} from "../../inventory-governance-contract";

interface CreateUomConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: UomConversionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateUomConversionModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateUomConversionModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<UomConversionFormValues>(EMPTY_UOM_CONVERSION_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_UOM_CONVERSION_FORM);
  const set = (patch: Partial<UomConversionFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_UOM_CONVERSION_FORM);
          onClose();
        }
      }}
      title={t.tradeInventory.conversionCreateTitle}
      description={t.tradeInventory.conversionCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
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
      <div className="flex flex-col gap-3">
        <Field label={t.tradeInventory.itemCompanyProfileId} required>
          <Input
            value={values.itemCompanyProfileId}
            disabled={isSubmitting}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ itemCompanyProfileId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.fromUom} required>
          <Input
            value={values.fromUomId}
            disabled={isSubmitting}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ fromUomId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.toUom} required>
          <Input
            value={values.toUomId}
            disabled={isSubmitting}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ toUomId: event.target.value })}
          />
        </Field>
        <Field
          label={t.tradeInventory.factorNumerator}
          required
          hint={t.tradeInventory.factorIntegerHint}
        >
          <Input
            value={values.factorNumerator}
            disabled={isSubmitting}
            inputMode="numeric"
            onChange={(event) => set({ factorNumerator: event.target.value })}
          />
        </Field>
        <Field
          label={t.tradeInventory.factorDenominator}
          required
          hint={t.tradeInventory.factorIntegerHint}
        >
          <Input
            value={values.factorDenominator}
            disabled={isSubmitting}
            inputMode="numeric"
            onChange={(event) => set({ factorDenominator: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.effectiveFrom} required>
          <Input
            type="datetime-local"
            value={values.effectiveFrom}
            disabled={isSubmitting}
            onChange={(event) => set({ effectiveFrom: event.target.value })}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
