"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CompanyOption } from "../../company-options";
import { EMPTY_TAX_FORM, type TaxFormValues } from "../tax-contract";
import { TaxFormFields } from "./TaxFormFields";

interface CreateTaxModalProps {
  isOpen: boolean;
  companies: CompanyOption[];
  tenantWideAllowed: boolean;
  onClose: () => void;
  onSubmit: (values: TaxFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateTaxModal({
  isOpen,
  companies,
  tenantWideAllowed,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateTaxModalProps) {
  const { t } = useI18n();
  const initial = { ...EMPTY_TAX_FORM, companyId: tenantWideAllowed ? null : companies[0]?.id ?? null };
  const [values, setValues] = useState<TaxFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  const close = () => {
    setValues(initial);
    onClose();
  };

  const handleSubmit = async () => {
    if (await onSubmit(values)) setValues(initial);
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.coreSettings.taxCreateTitle}
      description={t.coreSettings.taxCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
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
        tenantWideAllowed={tenantWideAllowed}
        isSubmitting={isSubmitting}
        scopeReadOnly={false}
      />
    </FormDrawer>
  );
}
