"use client";

import { useMemo } from "react";
import { NotFoundState } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CompanyOption } from "../../company-options";
import { useNumberingSequenceForm } from "../hooks/useNumberingSequenceForm";
import {
  toNumberingForm,
  type NumberingFormValues,
  type NumberingSequence,
} from "../numbering-contract";
import type { NumberingFieldErrors, NumberingFieldKey } from "../numbering-form-validation";
import { NumberingFormFields } from "./NumberingFormFields";
import { NumberingModalShell } from "./NumberingModalShell";

interface EditNumberingSequenceModalProps {
  readonly sequence: NumberingSequence;
  readonly companies: CompanyOption[];
  readonly onClose: () => void;
  readonly onSubmit: (values: NumberingFormValues) => Promise<boolean>;
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly serverFieldErrors?: NumberingFieldErrors;
  readonly onClearServerError?: (key?: NumberingFieldKey) => void;
  readonly notFound?: boolean;
}

/** Keyed on the row id by the screen, so it opens on the selected sequence. */
export function EditNumberingSequenceModal({
  sequence,
  companies,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  serverFieldErrors,
  onClearServerError,
  notFound = false,
}: EditNumberingSequenceModalProps) {
  const { t } = useI18n();
  const initialValues = useMemo<NumberingFormValues>(() => toNumberingForm(sequence), [sequence]);

  const form = useNumberingSequenceForm({
    mode: "edit",
    isOpen: true,
    initialValues,
    current: sequence,
    tenantWideAllowed: sequence.companyId === null,
    isSubmitting,
    error,
    serverFieldErrors,
    onClearServerError,
    counterLabel: t.coreSettings.numberingNextValue,
    onSubmit,
    onClose,
  });

  return (
    <NumberingModalShell
      open
      title={t.coreSettings.numberingEditTitle}
      isSubmitting={form.isBusy}
      submitDisabled={!form.isDirty}
      error={error}
      summaryItems={form.summaryItems}
      confirmingDiscard={notFound ? false : form.confirmingDiscard}
      setBody={form.setBody}
      onOpenAutoFocus={form.handleOpenAutoFocus}
      onFocusField={form.focusField}
      onRequestClose={notFound ? onClose : form.requestClose}
      onConfirmDiscard={form.confirmDiscard}
      onConfirmingDiscardChange={form.setConfirmingDiscard}
      onSubmit={(event) => void form.handleSubmit(event)}
      notFoundContent={
        notFound ? (
          <NotFoundState
            title={t.editDrawer.notFoundTitle}
            description={t.coreIdentity.errors.NOT_FOUND}
            backLabel={t.detail.back}
            onBack={onClose}
            className="py-8"
          />
        ) : undefined
      }
    >
      <NumberingFormFields
        values={form.values}
        onChange={form.updateValues}
        onBlurField={form.onBlurField}
        errors={form.fieldErrors}
        fieldAnchorIds={form.fieldAnchorIds}
        companies={companies}
        tenantWideAllowed={sequence.companyId === null}
        isSubmitting={form.isBusy}
        scopeReadOnly
        counterLabel={t.coreSettings.numberingNextValue}
      />
    </NumberingModalShell>
  );
}
