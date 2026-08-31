"use client";

import { useState } from "react";
import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ACQUISITION_SOURCE_NAME_MAX_LENGTH,
  type CreateAcquisitionSourceInput,
} from "../acquisition-source-contract";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAcquisitionSourceInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateAcquisitionSourcesModal({ isOpen, onClose, onSubmit, isSubmitting, error }: CreateModalProps) {
  const { t } = useI18n();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const isDirty = nameAr !== "" || nameEn !== "";

  const close = () => {
    setNameAr("");
    setNameEn("");
    onClose();
  };

  const handleSubmit = async () => {
    const saved = await onSubmit({ nameAr, nameEn });
    if (saved) {
      setNameAr("");
      setNameEn("");
    }
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.crmAcquisitionSources.addTitle}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      error={error ?? undefined}
      labels={{
        submit: isSubmitting ? t.crmAcquisitionSources.saving : t.crmAcquisitionSources.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <Field label={t.crmLeadStages.arabicName} required>
          <Input
            dir="rtl"
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field label={t.crmLeadStages.englishName} required>
          <Input
            dir="ltr"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
