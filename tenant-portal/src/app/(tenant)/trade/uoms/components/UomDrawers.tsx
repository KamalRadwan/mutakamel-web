"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_UOM_FORM, toUomForm, type Uom, type UomFormValues } from "../uom-contract";
import { UomFormFields } from "./UomFormFields";

interface UomDrawerProps {
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: UomFormValues) => Promise<boolean>;
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

export function CreateUomDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: UomDrawerProps & { isOpen: boolean }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const [values, setValues] = useState<UomFormValues>(EMPTY_UOM_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_UOM_FORM);

  const close = () => {
    setValues(EMPTY_UOM_FORM);
    onClose();
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.trade.uomCreateTitle}
      description={t.trade.uomCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_UOM_FORM);
        });
      }}
      error={error ?? undefined}
      labels={labels}
    >
      <UomFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        codeReadOnly={false}
        showStatus={false}
      />
    </FormDrawer>
  );
}

export function EditUomDrawer({
  uom,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: UomDrawerProps & { uom: Uom }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = toUomForm(uom);
  const [values, setValues] = useState<UomFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.uomEditTitle}
      description={t.trade.uomEditDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <UomFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        codeReadOnly
        showStatus
      />
    </FormDrawer>
  );
}
