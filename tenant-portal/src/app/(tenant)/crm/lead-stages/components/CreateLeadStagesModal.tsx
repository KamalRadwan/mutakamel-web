"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/I18nContext";
import {
  CREATABLE_LEAD_STAGE_FLAGS,
  LEAD_STAGE_CATEGORIES,
  type CreateLeadStageFormData,
  type LeadStageCategory,
} from "../lead-stage-contract";

interface CreateModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CreateLeadStageFormData) => Promise<boolean>;
}

const initialForm: CreateLeadStageFormData = {
  nameAr: "",
  nameEn: "",
  flag: "CONTACTED",
  category: "IN_PROGRESS",
  isDefault: false,
};

export function CreateLeadStagesModal({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CreateModalProps) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState<CreateLeadStageFormData>(initialForm);
  const copy =
    lang === "ar"
      ? {
          title: "إضافة مرحلة عميل",
          nameAr: "الاسم بالعربية",
          nameEn: "الاسم بالإنجليزية",
          flag: "الدلالة التشغيلية",
          category: "التصنيف",
          isDefault: "استخدامها كمرحلة افتراضية للعملاء الجدد",
          submit: "إنشاء المرحلة",
          submitting: "جارٍ إنشاء المرحلة...",
        }
      : {
          title: "Add lead stage",
          nameAr: "Arabic name",
          nameEn: "English name",
          flag: "Lifecycle flag",
          category: "Category",
          isDefault: "Use as the default stage for new leads",
          submit: "Create stage",
          submitting: "Creating stage...",
        };

  const close = () => {
    if (isSubmitting) return;
    setForm(initialForm);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await onSubmit(form)) setForm(initialForm);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={copy.title}
      maxWidth="md"
      closeDisabled={isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}
        <Input
          label={copy.nameAr}
          value={form.nameAr}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameAr: event.target.value }))
          }
          maxLength={80}
          required
          disabled={isSubmitting}
          dir="rtl"
        />
        <Input
          label={copy.nameEn}
          value={form.nameEn}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameEn: event.target.value }))
          }
          maxLength={80}
          required
          disabled={isSubmitting}
          dir="ltr"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={copy.flag}
            value={form.flag}
            onChange={(event) => {
              const flag = event.target
                .value as CreateLeadStageFormData["flag"];
              setForm((current) => ({
                ...current,
                flag,
                isDefault: flag === "CONVERTED" ? false : current.isDefault,
              }));
            }}
            options={CREATABLE_LEAD_STAGE_FLAGS.map((value) => ({
              value,
              label: value.replaceAll("_", " "),
            }))}
            disabled={isSubmitting}
          />
          <Select
            label={copy.category}
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value as LeadStageCategory,
              }))
            }
            options={LEAD_STAGE_CATEGORIES.map((value) => ({
              value,
              label: value.replaceAll("_", " "),
            }))}
            disabled={isSubmitting}
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isDefault: event.target.checked,
              }))
            }
            disabled={isSubmitting || form.flag === "CONVERTED"}
            className="size-4 rounded border-slate-300"
          />
          {copy.isDefault}
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            disabled={isSubmitting}
          >
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
