"use client";

import { Checkbox, Field, FormDrawer, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CRM_CUSTOM_FIELD_OWNER_TYPES,
  CRM_CUSTOM_FIELD_TYPES,
  type CreateCustomFieldInput,
  type CrmCustomFieldCreateOwnerType,
  type CrmCustomFieldType,
} from "../custom-field-contract";
import { useCustomFieldForm } from "../hooks/useCustomFieldForm";
import { CustomFieldOptionsEditor } from "./CustomFieldOptionsEditor";

interface CreateModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CreateCustomFieldInput) => Promise<boolean>;
}

export function CreateCrmCustomFieldsModal({ isOpen, isSubmitting, error, onClose, onSubmit }: CreateModalProps) {
  const { t } = useI18n();
  const form = useCustomFieldForm();
  const { nameAr, setNameAr, nameEn, setNameEn, fieldKey, setFieldKey, ownerType, setOwnerType,
    type, setType, isSearchable, setIsSearchable } = form;

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
      title={t.crmCustomFields.addTitle}
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void form.submitCreate(onSubmit, onClose)}
      error={error ?? form.validationError ?? undefined}
      labels={{
        submit: isSubmitting ? t.crmCustomFields.creating : t.crmCustomFields.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.crmLeadStages.arabicName} showLabel error={form.namesError ?? undefined} required>
            <Input size="sm" placeholder={t.crmLeadStages.arabicName}
              dir="rtl"
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
              maxLength={120}
              required
              disabled={isSubmitting}
            />
          </Field>
          <Field label={t.crmLeadStages.englishName} showLabel error={form.namesError ?? undefined} required>
            <Input size="sm" placeholder={t.crmLeadStages.englishName}
              dir="ltr"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              maxLength={120}
              required
              disabled={isSubmitting}
            />
          </Field>
        </div>

        <Field label={t.crmCustomFields.key} showLabel error={form.keyError ?? undefined} required>
          <Input size="sm"
            dir="ltr"
            value={fieldKey}
            onChange={(event) => setFieldKey(event.target.value)}
            placeholder="preferred_channel"
            maxLength={64}
            required
            disabled={isSubmitting}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.crmCustomFields.owner} showLabel>
            <Select value={ownerType} onValueChange={(value) => setOwnerType(value as CrmCustomFieldCreateOwnerType)}>
              <SelectTrigger size="sm" disabled={isSubmitting}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_CUSTOM_FIELD_OWNER_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.crmCustomFields.ownerTypes[value] ?? value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.crmCustomFields.fieldType} showLabel>
            <Select value={type} onValueChange={(value) => setType(value as CrmCustomFieldType)}>
              <SelectTrigger size="sm" disabled={isSubmitting}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_CUSTOM_FIELD_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.crmCustomFields.fieldTypes[value] ?? value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox
            checked={isSearchable}
            onCheckedChange={(checked) => setIsSearchable(checked === true)}
            disabled={isSubmitting}
          />
          {t.crmCustomFields.searchable}
        </label>

        {form.picklist ? <CustomFieldOptionsEditor form={form} disabled={isSubmitting} /> : null}
      </div>
    </FormDrawer>
  );
}
