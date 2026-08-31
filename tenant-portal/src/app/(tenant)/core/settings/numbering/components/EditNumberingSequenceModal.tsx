"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CompanyOption } from "../../company-options";
import {
  toNumberingForm,
  type NumberingFormValues,
  type NumberingSequence,
} from "../numbering-contract";
import { NumberingFormFields } from "./NumberingFormFields";

interface EditNumberingSequenceModalProps {
  sequence: NumberingSequence;
  companies: CompanyOption[];
  onClose: () => void;
  onSubmit: (values: NumberingFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/** Keyed on the row id by the screen, so it opens on the selected sequence. */
export function EditNumberingSequenceModal({
  sequence,
  companies,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: EditNumberingSequenceModalProps) {
  const { t } = useI18n();
  const initial = toNumberingForm(sequence);
  const [values, setValues] = useState<NumberingFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.coreSettings.numberingEditTitle}
      description={sequence.code}
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
      <NumberingFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        companies={companies}
        isSubmitting={isSubmitting}
        scopeReadOnly
        counterLabel={t.coreSettings.numberingNextValue}
        counterHint={formatTemplate(t.coreSettings.numberingNextValueHint, {
          current: sequence.nextValue,
        })}
      />
    </FormDrawer>
  );
}
