"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CompanyOption } from "../../company-options";
import { EMPTY_NUMBERING_FORM, type NumberingFormValues } from "../numbering-contract";
import { NumberingFormFields } from "./NumberingFormFields";

interface CreateNumberingSequenceModalProps {
  isOpen: boolean;
  companies: CompanyOption[];
  onClose: () => void;
  onSubmit: (values: NumberingFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateNumberingSequenceModal({
  isOpen,
  companies,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateNumberingSequenceModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<NumberingFormValues>(EMPTY_NUMBERING_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_NUMBERING_FORM);

  const close = () => {
    setValues(EMPTY_NUMBERING_FORM);
    onClose();
  };

  const handleSubmit = async () => {
    if (await onSubmit(values)) setValues(EMPTY_NUMBERING_FORM);
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.coreSettings.numberingCreateTitle}
      description={t.coreSettings.numberingCreateDescription}
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
      <NumberingFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        companies={companies}
        isSubmitting={isSubmitting}
        scopeReadOnly={false}
        counterLabel={t.coreSettings.numberingStartValue}
        counterHint={t.coreSettings.numberingStartValueHint}
      />
    </FormDrawer>
  );
}
