"use client";

import { FormInput } from "lucide-react";
import { Checkbox, Field, FormModal, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CRM_CUSTOM_FIELD_OWNER_TYPES, CRM_CUSTOM_FIELD_TYPES,
  type CreateCustomFieldInput, type CrmCustomFieldCreateOwnerType, type CrmCustomFieldType,
} from "../custom-field-contract";
import { useCustomFieldForm } from "../hooks/useCustomFieldForm";
import { CustomFieldOptionsEditor } from "./CustomFieldOptionsEditor";
import { CustomFieldMetadataFields } from "./CustomFieldMetadataFields";
import { CustomFieldPreview } from "./CustomFieldPreview";

interface CreateModalProps {
  isOpen: boolean; isSubmitting: boolean; error: string | null; keyError?: string | null;
  onClose: () => void; onSubmit: (data: CreateCustomFieldInput) => Promise<boolean>;
}

export function CreateCrmCustomFieldsModal({ isOpen, isSubmitting, error, keyError, onClose, onSubmit }: CreateModalProps) {
  const { t } = useI18n();
  const form = useCustomFieldForm();
  return (
    <FormModal size="wide" density="compact" open={isOpen}
      onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}
      title={t.crmCustomFields.addTitle} description={t.crmCustomFields.createDescription}
      headerIcon={<FormInput className="size-5 text-primary" aria-hidden="true" />}
      isDirty={form.isDirty} isSubmitting={isSubmitting}
      onSubmit={() => void form.submitCreate(onSubmit, onClose)}
      error={error ?? keyError ?? form.validationError ?? undefined}
      footerLeading={<p className="text-xs text-muted-foreground">{t.crmCustomFields.requirementsAfterCreate}</p>}
      labels={{ submit: isSubmitting ? t.crmCustomFields.creating : t.crmCustomFields.create,
        cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmCustomFields.additionalSettings, sectionInvalid: t.crmCustomFields.invalidNames }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.crmLeadStages.arabicName} showLabel error={form.namesError ?? undefined} required>
          <Input dir="rtl" value={form.nameAr} maxLength={120} required disabled={isSubmitting}
            onChange={(event) => form.setNameAr(event.target.value)} />
        </Field>
        <Field label={t.crmLeadStages.englishName} showLabel error={form.namesError ?? undefined} required>
          <Input dir="ltr" value={form.nameEn} maxLength={120} required disabled={isSubmitting}
            onChange={(event) => form.setNameEn(event.target.value)} />
        </Field>
        <Field label={t.crmCustomFields.key} showLabel hint={t.crmCustomFields.keyHelp}
          error={form.keyError ?? keyError ?? undefined} required className="sm:col-span-2">
          <Input dir="ltr" className="font-mono" value={form.fieldKey} onChange={(event) => form.setFieldKey(event.target.value)}
            maxLength={64} required disabled={isSubmitting} />
        </Field>
        <Field label={t.crmCustomFields.owner} showLabel required>
          <Select value={form.ownerType} disabled={isSubmitting}
            onValueChange={(value) => form.setOwnerType(value as CrmCustomFieldCreateOwnerType)}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>{CRM_CUSTOM_FIELD_OWNER_TYPES.map((value) => (
              <SelectItem key={value} value={value}>{t.crmCustomFields.ownerTypes[value]}</SelectItem>
            ))}</SelectContent>
          </Select>
        </Field>
        <Field label={t.crmCustomFields.fieldType} showLabel required hint={t.crmCustomFields.immutableTypeHint}>
          <Select value={form.type} disabled={isSubmitting} onValueChange={(value) => form.setType(value as CrmCustomFieldType)}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>{CRM_CUSTOM_FIELD_TYPES.map((value) => (
              <SelectItem key={value} value={value}>{t.crmCustomFields.fieldTypes[value]}</SelectItem>
            ))}</SelectContent>
          </Select>
        </Field>
      </div>
      {form.picklist ? <CustomFieldOptionsEditor form={form} disabled={isSubmitting} /> : null}
      <label className="flex w-fit items-center gap-2 py-1 text-xs">
        <Checkbox checked={form.isSearchable} disabled={isSubmitting}
          onCheckedChange={(checked) => form.setIsSearchable(checked === true)} />{t.crmCustomFields.searchable}
      </label>
      <CustomFieldMetadataFields form={form} disabled={isSubmitting} />
      <CustomFieldPreview form={form} />
    </FormModal>
  );
}
