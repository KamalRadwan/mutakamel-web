"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function CustomFieldGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [label, setLabel] = useState(t.crm.expectedClientBudget);
  const [key, setKey] = useState("expected_budget");
  const [targetEntity, setTargetEntity] = useState("lead");
  const [fieldType, setFieldType] = useState("number");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationOfCustom}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateFieldTitleAndTypeIn}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.fieldTitle} value={label} onChange={(e) => setLabel(e.target.value)} required />
        <Input label={t.crm.key} value={key} onChange={(e) => setKey(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.crm.targetEntity}
            value={targetEntity}
            onChange={(e) => setTargetEntity(e.target.value)}
            options={[
              { label: t.crm.lead, value: "lead" },
              { label: t.crm.deal, value: "deal" },
            ]}
          />
          <Select
            label={t.crm.fieldType}
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            options={[
              { label: t.crm.number, value: "number" },
              { label: t.crm.text, value: "text" },
            ]}
          />
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>{t.crm.saveLiveEdits}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
