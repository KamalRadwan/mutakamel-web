"use client";

import { LockKeyhole, Pencil } from "lucide-react";
import { Checkbox, Field, FormModal, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { useCustomFieldEdit } from "../hooks/useCustomFieldEdit";
import { useCustomFieldForm } from "../hooks/useCustomFieldForm";
import { CustomFieldOptionsEditor } from "./CustomFieldOptionsEditor";
import { CustomFieldMetadataFields } from "./CustomFieldMetadataFields";
import { CustomFieldPreview } from "./CustomFieldPreview";

export function CustomFieldEditDrawer({ editor }: { editor: ReturnType<typeof useCustomFieldEdit> }) {
  const { t, lang } = useI18n();
  const form = useCustomFieldForm(editor.selected);
  return (
    <FormModal size="wide" density="compact" open={!!editor.selected}
      onOpenChange={(open) => { if (!open) editor.close(); }}
      title={t.crmCustomFields.editTitle}
      description={editor.selected ? localizedValue(editor.selected.nameAr, editor.selected.nameEn, lang) : undefined}
      headerIcon={<Pencil className="size-5 text-primary" aria-hidden="true" />}
      isDirty={form.isDirty} isSubmitting={editor.isSaving}
      submitDisabled={!form.isDirty || (editor.optionConflict && form.optionActivityChanged)}
      onSubmit={() => void form.submitEdit(editor.save)}
      error={(editor.optionConflict ? null : editor.error) ?? form.validationError ?? undefined}
      labels={{ submit: editor.isSaving ? t.crmCustomFields.saving : t.crmCustomFields.save,
        cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmCustomFields.additionalSettings, sectionInvalid: t.crmCustomFields.invalidNames }}>
      {editor.selected ? <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-xs text-muted-foreground">
        <LockKeyhole className="size-3.5" aria-hidden="true" />
        <span>{t.crmCustomFields.ownerTypes[editor.selected.ownerType]}</span><span aria-hidden="true">·</span>
        <span>{t.crmCustomFields.fieldTypes[editor.selected.type]}</span><span aria-hidden="true">·</span>
        <code dir="ltr" className="font-mono text-foreground">{editor.selected.fieldKey}</code>
        <p className="w-full">{t.crmCustomFields.identityReadOnly}</p>
      </div> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.crmLeadStages.arabicName} showLabel required error={form.namesError ?? undefined}>
          <Input dir="rtl" value={form.nameAr} maxLength={120} disabled={editor.isSaving} required
            onChange={(event) => form.setNameAr(event.target.value)} />
        </Field>
        <Field label={t.crmLeadStages.englishName} showLabel required error={form.namesError ?? undefined}>
          <Input dir="ltr" value={form.nameEn} maxLength={120} disabled={editor.isSaving} required
            onChange={(event) => form.setNameEn(event.target.value)} />
        </Field>
      </div>
      {form.picklist ? <CustomFieldOptionsEditor form={form} disabled={editor.isSaving}
        conflict={editor.optionConflict ? editor.error : null}
        onRestoreActivity={() => { form.restoreOptionActivity(); editor.clearOptionConflict(); }} /> : null}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-1">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={form.isActive} disabled={editor.isSaving}
            onCheckedChange={(checked) => form.setIsActive(checked === true)} />{t.common.active}
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={form.isSearchable} disabled={editor.isSaving}
            onCheckedChange={(checked) => form.setIsSearchable(checked === true)} />{t.crmCustomFields.searchable}
        </label>
        <p className="text-xs text-muted-foreground">{t.crmCustomFields.activeFieldHint}</p>
      </div>
      <CustomFieldMetadataFields form={form} disabled={editor.isSaving} />
      <CustomFieldPreview form={form} />
    </FormModal>
  );
}
