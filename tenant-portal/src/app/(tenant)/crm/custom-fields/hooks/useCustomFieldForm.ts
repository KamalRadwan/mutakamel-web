"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  isPicklistField, isValidCrmCustomFieldKey, normalizeCrmCustomFieldKey, validCustomFieldOptions,
  type CreateCustomFieldInput, type CrmCustomFieldCreateOwnerType, type CrmCustomFieldType,
  type CustomFieldItem, type CustomFieldOption, type UpdateCustomFieldInput,
} from "../custom-field-contract";

interface OptionDraft extends CustomFieldOption { rowId: string; persisted: boolean }

export function useCustomFieldForm(field?: CustomFieldItem | null) {
  const { t } = useI18n();
  const [nameAr, setNameAr] = useState(field?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(field?.nameEn ?? "");
  const [fieldKey, setFieldKey] = useState(field?.fieldKey ?? "");
  const [ownerType, setOwnerType] = useState<CrmCustomFieldCreateOwnerType>("LEAD");
  const [type, setType] = useState<CrmCustomFieldType>(field?.type ?? "TEXT");
  const [isSearchable, setIsSearchable] = useState(field?.isSearchable ?? false);
  const [isActive, setIsActive] = useState(field?.isActive ?? true);
  const [options, setOptions] = useState<OptionDraft[]>(() => (field?.options ?? []).map((option) => ({
    ...option, rowId: generateUUIDv7(), persisted: true,
  })));
  const [attempted, setAttempted] = useState(false);
  const picklist = isPicklistField(type);
  const namesValid = [nameAr, nameEn].every((value) => value.trim().length > 0 && value.trim().length <= 120);
  const keyValid = isValidCrmCustomFieldKey(normalizeCrmCustomFieldKey(fieldKey));
  const optionPayload = options.map(({ key, nameAr, nameEn, sortOrder, isActive, persisted }) => ({
    key: persisted ? key : key.trim(), nameAr: nameAr.trim(), nameEn: nameEn.trim(), sortOrder, isActive,
  }));
  const optionsValid = !picklist || validCustomFieldOptions(optionPayload);
  const optionsChanged = picklist && JSON.stringify(optionPayload) !== JSON.stringify(field?.options ?? []);
  const namesError = attempted && !namesValid ? t.crmCustomFields.invalidNames : null;
  const keyError = attempted && !keyValid ? t.crmCustomFields.invalidKey : null;
  const optionsError = attempted && !optionsValid ? t.crmCustomFields.invalidOptions : null;
  const metadata = { nameAr: nameAr.trim(), nameEn: nameEn.trim(), isSearchable,
    ...(picklist ? { options: optionPayload } : {}) };
  const isDirty = field
    ? nameAr !== field.nameAr || nameEn !== field.nameEn || isActive !== field.isActive || isSearchable !== field.isSearchable ||
      optionsChanged
    : nameAr !== "" || nameEn !== "" || fieldKey !== "" || ownerType !== "LEAD" || type !== "TEXT" || isSearchable || options.length > 0;

  function validate(): boolean {
    setAttempted(true);
    return namesValid && (field ? true : keyValid) && optionsValid;
  }

  return {
    nameAr, setNameAr, nameEn, setNameEn, fieldKey, setFieldKey, ownerType, setOwnerType,
    type, setType, isSearchable, setIsSearchable, isActive, setIsActive, options, picklist, isDirty,
    namesError, keyError, optionsError,
    validationError: namesError ?? (field ? null : keyError) ?? optionsError,
    addOption: () => {
      if (options.length >= 100) return;
      setOptions((current) => [...current, { rowId: generateUUIDv7(), persisted: false,
        key: "", nameAr: "", nameEn: "", isActive: true, sortOrder: Math.max(0, ...current.map((option) => option.sortOrder)) + 1 }]);
    },
    updateOption: (rowId: string, change: Partial<CustomFieldOption>) => setOptions((current) => current.map((option) => {
      if (option.rowId !== rowId) return option;
      // A persisted option's key is its stored identity, even when deactivated.
      return { ...option, ...change, key: option.persisted ? option.key : (change.key ?? option.key) };
    })),
    removeOption: (rowId: string) => setOptions((current) => current.filter((option) => option.rowId !== rowId || option.persisted)),
    submitCreate: async (onSubmit: (input: CreateCustomFieldInput) => Promise<boolean>, onClose: () => void) => {
      if (!validate()) return;
      if (await onSubmit({ ...metadata, ownerType, fieldKey: normalizeCrmCustomFieldKey(fieldKey), type })) onClose();
    },
    submitEdit: async (onSubmit: (input: UpdateCustomFieldInput) => Promise<boolean>) => {
      if (validate()) await onSubmit({ nameAr: metadata.nameAr, nameEn: metadata.nameEn, isSearchable, isActive,
        ...(optionsChanged ? { options: optionPayload } : {}) });
    },
  };
}
