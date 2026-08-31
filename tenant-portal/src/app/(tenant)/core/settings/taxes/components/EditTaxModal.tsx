"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CompanyOption } from "../../company-options";
import { toTaxForm, type Tax, type TaxFormValues } from "../tax-contract";
import { TaxFormFields } from "./TaxFormFields";

interface EditTaxModalProps {
  tax: Tax;
  companies: CompanyOption[];
  onClose: () => void;
  onSubmit: (values: TaxFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/** Keyed on the row id by the screen, so it opens on the selected tax by construction. */
export function EditTaxModal({
  tax,
  companies,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: EditTaxModalProps) {
  const { t } = useI18n();
  const initial = toTaxForm(tax);
  const [values, setValues] = useState<TaxFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.coreSettings.taxEditTitle}
      description={tax.code}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={{
        submit: t.coreSettings.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <TaxFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        companies={companies}
        isSubmitting={isSubmitting}
        scopeReadOnly
      />
    </FormDrawer>
  );
}
