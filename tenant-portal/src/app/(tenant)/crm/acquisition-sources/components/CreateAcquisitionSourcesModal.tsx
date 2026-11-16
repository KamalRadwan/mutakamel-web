"use client";

import { Field, FormModal, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ACQUISITION_SOURCE_NAME_MAX_LENGTH,
  type CreateAcquisitionSourceInput,
} from "../acquisition-source-contract";
import { useAcquisitionSourceCreateForm } from "../hooks/useAcquisitionSourceCreateForm";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAcquisitionSourceInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateAcquisitionSourcesModal({ isOpen, onClose, onSubmit, isSubmitting, error }: CreateModalProps) {
  const { t } = useI18n();
  const form = useAcquisitionSourceCreateForm(onSubmit, onClose);

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) form.close();
      }}
      title={t.crmAcquisitionSources.addTitle}
      size="card"
      density="compact"
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void form.submit()}
      error={form.error ?? error ?? undefined}
      labels={{
        submit: isSubmitting ? t.crmAcquisitionSources.saving : t.crmAcquisitionSources.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
        close: t.common.close,
      }}
    >
      <div className="flex flex-col gap-3">
        <Field label={t.crmLeadStages.arabicName} showLabel required hint={t.crmAcquisitionSources.nameHelp} error={form.errors.nameAr}>
          <Input size="sm" placeholder={t.crmLeadStages.arabicName}
            dir="rtl"
            value={form.draft.nameAr}
            onChange={(event) => form.setDraft({ ...form.draft, nameAr: event.target.value })}
            maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field label={t.crmLeadStages.englishName} showLabel required hint={t.crmAcquisitionSources.nameHelp} error={form.errors.nameEn}>
          <Input size="sm" placeholder={t.crmLeadStages.englishName}
            dir="ltr"
            value={form.draft.nameEn}
            onChange={(event) => form.setDraft({ ...form.draft, nameEn: event.target.value })}
            maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
        <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">{t.crmAcquisitionSources.iconAfterCreateHint}</p>
      </div>
    </FormModal>
  );
}
