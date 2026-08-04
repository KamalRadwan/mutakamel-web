"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function CatalogueGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [catalogName, setCatalogName] = useState(t.crm.guideToEconomicSectorsAnd);
  const [category, setCategory] = useState("industry_types");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationOfTheRef}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateTheNameAndClassifica}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.referenceCatalogName} value={catalogName} onChange={(e) => setCatalogName(e.target.value)} required />
        <Select
          label={t.crm.referenceClassification}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { label: t.crm.industryTypes, value: "industry_types" },
            { label: t.crm.dealLostReasons, value: "deal_reasons" },
          ]}
        />

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
