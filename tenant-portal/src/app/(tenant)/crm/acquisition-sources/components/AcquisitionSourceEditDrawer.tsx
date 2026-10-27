"use client";

import { Checkbox, Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ACQUISITION_SOURCE_NAME_MAX_LENGTH } from "../acquisition-source-contract";
import type { useAcquisitionSourceEdit } from "../hooks/useAcquisitionSourceEdit";

export function AcquisitionSourceEditDrawer({ editor }: { editor: ReturnType<typeof useAcquisitionSourceEdit> }) {
  const { t } = useI18n();
  return (
    <FormDrawer
      open={!!editor.selected}
      onOpenChange={(open) => { if (!open) editor.close(); }}
      title={t.crmAcquisitionSources.editTitle}
      isDirty={editor.isDirty}
      isSubmitting={editor.isSaving}
      onSubmit={() => void editor.save()}
      error={editor.error ?? editor.namesError ?? undefined}
      labels={{ submit: editor.isSaving ? t.crmAcquisitionSources.saving : t.crmAcquisitionSources.save,
        cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel }}
    >
      <div className="flex flex-col gap-4">
        <Field label={t.crmLeadStages.arabicName} showLabel required error={editor.namesError ?? undefined}>
          <Input dir="rtl" value={editor.draft.nameAr} maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            onChange={(event) => editor.setDraft({ ...editor.draft, nameAr: event.target.value })} disabled={editor.isSaving} required />
        </Field>
        <Field label={t.crmLeadStages.englishName} showLabel required error={editor.namesError ?? undefined}>
          <Input dir="ltr" value={editor.draft.nameEn} maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            onChange={(event) => editor.setDraft({ ...editor.draft, nameEn: event.target.value })} disabled={editor.isSaving} required />
        </Field>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox checked={editor.draft.isActive} disabled={editor.isSaving}
            onCheckedChange={(checked) => editor.setDraft({ ...editor.draft, isActive: checked === true })} />
          {t.common.active}
        </label>
      </div>
    </FormDrawer>
  );
}
