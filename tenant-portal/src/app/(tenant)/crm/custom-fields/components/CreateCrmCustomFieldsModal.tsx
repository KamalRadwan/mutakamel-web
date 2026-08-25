"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/I18nContext";
import {
  CRM_CUSTOM_FIELD_OWNER_TYPES,
  CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES,
  isValidCrmCustomFieldKey,
  normalizeCrmCustomFieldKey,
  type CreateCustomFieldInput,
  type CrmCustomFieldCreateOwnerType,
  type CrmCustomFieldSimpleCreateType,
} from "../hooks/useCrmCustomFields";

interface CreateModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CreateCustomFieldInput) => Promise<boolean>;
}

export function CreateCrmCustomFieldsModal({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CreateModalProps) {
  const { lang } = useI18n();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [ownerType, setOwnerType] =
    useState<CrmCustomFieldCreateOwnerType>("LEAD");
  const [type, setType] = useState<CrmCustomFieldSimpleCreateType>("TEXT");
  const [isSearchable, setIsSearchable] = useState(false);
  const [nameValidationError, setNameValidationError] = useState<string | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const copy =
    lang === "ar"
      ? {
          title: "إضافة حقل مخصص",
          nameAr: "الاسم بالعربية",
          nameEn: "الاسم بالإنجليزية",
          key: "المفتاح",
          owner: "نوع السجل",
          type: "نوع الحقل",
          searchable: "قابل للبحث",
          simpleTypes:
            "أنواع الاختيار تحتاج محرر خيارات غير متاح هنا، لذلك لا تُرسل من هذا النموذج.",
          invalidKey:
            "يجب أن يبدأ المفتاح بحرف إنجليزي وأن يحتوي حروفًا صغيرة أو أرقامًا أو شرطات سفلية فقط.",
          invalidNames: "الاسمان العربي والإنجليزي مطلوبان.",
          cancel: "إلغاء",
          save: "إنشاء الحقل",
          saving: "جارٍ الإنشاء...",
        }
      : {
          title: "Add custom field",
          nameAr: "Arabic name",
          nameEn: "English name",
          key: "Field key",
          owner: "Record type",
          type: "Field type",
          searchable: "Searchable",
          simpleTypes:
            "Select fields require an option editor, so this form does not submit them.",
          invalidKey:
            "The key must start with a letter and contain only lowercase letters, numbers, or underscores.",
          invalidNames: "Both Arabic and English names are required.",
          cancel: "Cancel",
          save: "Create field",
          saving: "Creating...",
        };

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedKey = normalizeCrmCustomFieldKey(fieldKey);
    if (!nameAr.trim() || !nameEn.trim()) {
      setNameValidationError(copy.invalidNames);
      return;
    }
    setNameValidationError(null);
    if (!isValidCrmCustomFieldKey(normalizedKey)) {
      setValidationError(copy.invalidKey);
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
    if (created) {
      reset();
      onClose();
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={copy.title}
      maxWidth="lg"
      closeDisabled={isSubmitting}
      initialFocusSelector='input[name="nameAr"]'
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            name="nameAr"
            label={copy.nameAr}
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            maxLength={120}
            required
            disabled={isSubmitting}
            dir="rtl"
            error={nameValidationError ?? undefined}
          />
          <Input
            name="nameEn"
            label={copy.nameEn}
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            maxLength={120}
            required
            disabled={isSubmitting}
            dir="ltr"
            error={nameValidationError ?? undefined}
          />
        </div>

        <Input
          label={copy.key}
          value={fieldKey}
          onChange={(event) => setFieldKey(event.target.value)}
          placeholder="preferred_channel"
          maxLength={64}
          required
          disabled={isSubmitting}
          dir="ltr"
          error={validationError ?? undefined}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label={copy.owner}
            value={ownerType}
            onChange={(event) =>
              setOwnerType(event.target.value as CrmCustomFieldCreateOwnerType)
            }
            options={CRM_CUSTOM_FIELD_OWNER_TYPES.map((value) => ({
              label: value.replaceAll("_", " "),
              value,
            }))}
            disabled={isSubmitting}
          />
          <Select
            label={copy.type}
            value={type}
            onChange={(event) =>
              setType(event.target.value as CrmCustomFieldSimpleCreateType)
            }
            options={CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES.map((value) => ({
              label: value.replaceAll("_", " "),
              value,
            }))}
            disabled={isSubmitting}
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={isSearchable}
            onChange={(event) => setIsSearchable(event.target.checked)}
            disabled={isSubmitting}
            className="size-4 rounded text-blue-600 focus:ring-blue-500"
          />
          {copy.searchable}
        </label>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {copy.simpleTypes}
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {copy.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? copy.saving : copy.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
