"use client";

import { Checkbox, Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useCustomFieldEdit } from "../hooks/useCustomFieldEdit";
import { useCustomFieldForm } from "../hooks/useCustomFieldForm";
import { CustomFieldOptionsEditor } from "./CustomFieldOptionsEditor";

export function CustomFieldEditDrawer({ editor }: { editor: ReturnType<typeof useCustomFieldEdit> }) {
  const { t } = useI18n();
  const form = useCustomFieldForm(editor.selected);
  return (
    <FormDrawer open={!!editor.selected} onOpenChange={(open) => { if (!open) editor.close(); }}
      title={t.crmCustomFields.editTitle} isDirty={form.isDirty} isSubmitting={editor.isSaving}
      onSubmit={() => void form.submitEdit(editor.save)} error={editor.error ?? form.validationError ?? undefined}
      labels={{ submit: editor.isSaving ? t.crmCustomFields.saving : t.crmCustomFields.save,
        cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel }}>
      <div className="flex flex-col gap-4">
        <Field label={t.crmLeadStages.arabicName} showLabel required error={form.namesError ?? undefined}>
          <Input dir="rtl" value={form.nameAr} maxLength={120} disabled={editor.isSaving} required
            onChange={(event) => form.setNameAr(event.target.value)} />
        </Field>
        <Field label={t.crmLeadStages.englishName} showLabel required error={form.namesError ?? undefined}>
          <Input dir="ltr" value={form.nameEn} maxLength={120} disabled={editor.isSaving} required
            onChange={(event) => form.setNameEn(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox checked={form.isActive} disabled={editor.isSaving}
            onCheckedChange={(checked) => form.setIsActive(checked === true)} />{t.common.active}
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox checked={form.isSearchable} disabled={editor.isSaving}
            onCheckedChange={(checked) => form.setIsSearchable(checked === true)} />{t.crmCustomFields.searchable}
        </label>
        {form.picklist ? <CustomFieldOptionsEditor form={form} disabled={editor.isSaving} /> : null}
      </div>
    </FormDrawer>
  );
}
