"use client";

import { ImagePlus } from "lucide-react";
import { Button, Checkbox, Field, FormModal, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ACQUISITION_SOURCE_NAME_MAX_LENGTH } from "../acquisition-source-contract";
import type { useAcquisitionSourceEdit } from "../hooks/useAcquisitionSourceEdit";
import { SourceIconPreview } from "./SourceIconPreview";

export function AcquisitionSourceEditModal({ editor, onManageIcon }: {
  editor: ReturnType<typeof useAcquisitionSourceEdit>;
  onManageIcon: () => void;
}) {
  const { t } = useI18n();
  return (
    <FormModal
      open={!!editor.selected}
      onOpenChange={(open) => { if (!open) editor.close(); }}
      title={t.crmAcquisitionSources.editTitle}
      size="card"
      density="compact"
      isDirty={editor.isDirty}
      isSubmitting={editor.isSaving}
      onSubmit={() => void editor.save()}
      error={editor.error ?? editor.namesError ?? undefined}
      labels={{ submit: editor.isSaving ? t.crmAcquisitionSources.saving : t.crmAcquisitionSources.save,
        cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav, sectionInvalid: t.crmShared.formSectionInvalid, close: t.common.close }}
    >
      <div className="flex flex-col gap-3">
        <Field label={t.crmLeadStages.arabicName} showLabel required hint={t.crmAcquisitionSources.nameHelp} error={editor.fieldErrors.nameAr}>
          <Input size="sm" dir="rtl" value={editor.draft.nameAr} maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            onChange={(event) => editor.setDraft({ ...editor.draft, nameAr: event.target.value })} disabled={editor.isSaving} required />
        </Field>
        <Field label={t.crmLeadStages.englishName} showLabel required hint={t.crmAcquisitionSources.nameHelp} error={editor.fieldErrors.nameEn}>
          <Input size="sm" dir="ltr" value={editor.draft.nameEn} maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
            onChange={(event) => editor.setDraft({ ...editor.draft, nameEn: event.target.value })} disabled={editor.isSaving} required />
        </Field>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox checked={editor.draft.isActive} disabled={editor.isSaving}
            onCheckedChange={(checked) => editor.setDraft({ ...editor.draft, isActive: checked === true })} />
          {t.common.active}
        </label>
        <p className="text-xs text-muted-foreground">{t.crmAcquisitionSources.inactiveHelp}</p>
        {editor.selected && <div className="flex flex-col gap-2 rounded-md border border-border bg-muted p-3">
          <div className="flex flex-wrap items-center gap-3">
            <SourceIconPreview source={editor.selected} />
            <span className="text-sm font-medium">{t.crmAcquisitionSources.iconTitle}</span>
            <Button variant="outline" size="sm" className="ms-auto" onClick={onManageIcon}
              disabled={editor.isSaving || editor.isDirty}>
              <ImagePlus className="size-3.5" aria-hidden="true" />
              {editor.selected.iconUrl ? t.crmAcquisitionSources.changeIcon : t.crmAcquisitionSources.addIcon}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.crmAcquisitionSources.iconDescription}</p>
          {editor.isDirty && <p role="status" className="text-xs text-muted-foreground">{t.crmAcquisitionSources.iconSaveChangesFirst}</p>}
        </div>}
      </div>
    </FormModal>
  );
}
