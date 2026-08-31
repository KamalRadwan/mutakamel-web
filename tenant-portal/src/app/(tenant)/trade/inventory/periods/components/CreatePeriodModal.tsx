"use client";

import { useState } from "react";
import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_PERIOD_FORM, type PeriodFormValues } from "../../inventory-governance-contract";

interface CreatePeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PeriodFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreatePeriodModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreatePeriodModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<PeriodFormValues>(EMPTY_PERIOD_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_PERIOD_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_PERIOD_FORM);
          onClose();
        }
      }}
      title={t.tradeInventory.periodCreateTitle}
      description={t.tradeInventory.periodCreateDescription}
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
        <Field label={t.tradeInventory.periodCode} required hint={t.tradeInventory.codePatternHint}>
          <Input
            value={values.code}
            disabled={isSubmitting}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
          />
        </Field>
        <Field label={t.tradeInventory.periodStartsOn} required hint={t.tradeInventory.plainDateHint}>
          <Input
            type="date"
            value={values.startsOn}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, startsOn: event.target.value }))
            }
          />
        </Field>
        <Field label={t.tradeInventory.periodEndsOn} required hint={t.tradeInventory.plainDateHint}>
          <Input
            type="date"
            value={values.endsOn}
            disabled={isSubmitting}
            onChange={(event) => setValues((current) => ({ ...current, endsOn: event.target.value }))}
          />
        </Field>
        <Field
          label={t.tradeInventory.periodMaxBackdateDays}
          required
          hint={t.tradeInventory.periodMaxBackdateHint}
        >
          <Input
            type="number"
            min={0}
            max={366}
            value={values.maxBackdateDays}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, maxBackdateDays: event.target.value }))
            }
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
