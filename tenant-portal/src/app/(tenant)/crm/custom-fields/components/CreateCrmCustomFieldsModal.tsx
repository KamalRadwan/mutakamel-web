"use client";

import { useState, type FormEvent } from "react";
import { Checkbox, Field, FormDrawer, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CRM_CUSTOM_FIELD_OWNER_TYPES,
  CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES,
  isValidCrmCustomFieldKey,
  normalizeCrmCustomFieldKey,
  type CreateCustomFieldInput,
  type CrmCustomFieldCreateOwnerType,
  type CrmCustomFieldSimpleCreateType,
} from "../custom-field-contract";

interface CreateModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CreateCustomFieldInput) => Promise<boolean>;
}

export function CreateCrmCustomFieldsModal({ isOpen, isSubmitting, error, onClose, onSubmit }: CreateModalProps) {
  const { t } = useI18n();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [ownerType, setOwnerType] = useState<CrmCustomFieldCreateOwnerType>("LEAD");
  const [type, setType] = useState<CrmCustomFieldSimpleCreateType>("TEXT");
  const [isSearchable, setIsSearchable] = useState(false);
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isDirty = nameAr !== "" || nameEn !== "" || fieldKey !== "";

  const reset = () => {
    setNameAr("");
    setNameEn("");
    setFieldKey("");
    setOwnerType("LEAD");
    setType("TEXT");
    setIsSearchable(false);
    setNameValidationError(null);
    setValidationError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalizedKey = normalizeCrmCustomFieldKey(fieldKey);
    if (!nameAr.trim() || !nameEn.trim()) {
      setNameValidationError(t.crmCustomFields.invalidNames);
      return;
    }
    setNameValidationError(null);
    if (!isValidCrmCustomFieldKey(normalizedKey)) {
      setValidationError(t.crmCustomFields.invalidKey);
      return;
    }
    setValidationError(null);
    const created = await onSubmit({
      ownerType,
      fieldKey: normalizedKey,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
      type,
      isSearchable,
    });
    if (created) close();
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.crmCustomFields.addTitle}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      error={error ?? undefined}
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
          <Field label={t.crmLeadStages.arabicName} error={nameValidationError ?? undefined} required>
            <Input
              dir="rtl"
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
              maxLength={120}
              required
              disabled={isSubmitting}
            />
          </Field>
          <Field label={t.crmLeadStages.englishName} error={nameValidationError ?? undefined} required>
            <Input
              dir="ltr"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              maxLength={120}
              required
              disabled={isSubmitting}
            />
          </Field>
        </div>

        <Field label={t.crmCustomFields.key} error={validationError ?? undefined} required>
          <Input
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
          <Field label={t.crmCustomFields.owner}>
            <Select value={ownerType} onValueChange={(value) => setOwnerType(value as CrmCustomFieldCreateOwnerType)}>
              <SelectTrigger disabled={isSubmitting}>
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
          <Field label={t.crmCustomFields.fieldType}>
            <Select value={type} onValueChange={(value) => setType(value as CrmCustomFieldSimpleCreateType)}>
              <SelectTrigger disabled={isSubmitting}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES.map((value) => (
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

        <p className="text-xs text-muted-foreground">{t.crmCustomFields.simpleTypesNote}</p>
      </div>
    </FormDrawer>
  );
}
