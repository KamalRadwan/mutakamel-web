"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { CompanyOption } from "../../company-options";
import { useNumberingSequenceForm } from "../hooks/useNumberingSequenceForm";
import { EMPTY_NUMBERING_FORM, type NumberingFormValues } from "../numbering-contract";
import type { NumberingFieldErrors, NumberingFieldKey } from "../numbering-form-validation";
import { NumberingFormFields } from "./NumberingFormFields";
import { NumberingModalShell } from "./NumberingModalShell";

interface CreateNumberingSequenceModalProps {
  readonly isOpen: boolean;
  readonly companies: CompanyOption[];
  readonly tenantWideAllowed: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (values: NumberingFormValues) => Promise<boolean>;
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly serverFieldErrors?: NumberingFieldErrors;
  readonly onClearServerError?: (key?: NumberingFieldKey) => void;
}

export function CreateNumberingSequenceModal({
  isOpen,
  companies,
  tenantWideAllowed,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  serverFieldErrors,
  onClearServerError,
}: CreateNumberingSequenceModalProps) {
  const { t } = useI18n();
  const defaultCompanyId = tenantWideAllowed ? null : companies[0]?.id ?? null;
  const initialValues = useMemo<NumberingFormValues>(
    () => ({ ...EMPTY_NUMBERING_FORM, companyId: defaultCompanyId }),
    [defaultCompanyId],
  );

  const form = useNumberingSequenceForm({
    mode: "create",
    isOpen,
    initialValues,
    tenantWideAllowed,
    isSubmitting,
    error,
    serverFieldErrors,
    onClearServerError,
    counterLabel: t.coreSettings.numberingStartValue,
    onSubmit,
    onClose,
  });

  return (
    <NumberingModalShell
      open={isOpen}
      title={t.coreSettings.numberingCreateTitle}
      isSubmitting={form.isBusy}
      error={error}
      summaryItems={form.summaryItems}
      confirmingDiscard={form.confirmingDiscard}
      setBody={form.setBody}
      onOpenAutoFocus={form.handleOpenAutoFocus}
      onFocusField={form.focusField}
      onRequestClose={form.requestClose}
      onConfirmDiscard={form.confirmDiscard}
      onConfirmingDiscardChange={form.setConfirmingDiscard}
      onSubmit={(event) => void form.handleSubmit(event)}
    >
      <NumberingFormFields
        values={form.values}
        onChange={form.updateValues}
        onBlurField={form.onBlurField}
        errors={form.fieldErrors}
        fieldAnchorIds={form.fieldAnchorIds}
        companies={companies}
        tenantWideAllowed={tenantWideAllowed}
        isSubmitting={form.isBusy}
        scopeReadOnly={false}
        counterLabel={t.coreSettings.numberingStartValue}
      />
    </NumberingModalShell>
  );
}
