"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function LeadStageGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [name, setName] = useState(t.crm.newLead);
  const [order, setOrder] = useState(1);
  const [color, setColor] = useState("#3b82f6");
  const [winProbability, setWinProbability] = useState("10%");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationOfTheSal}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateTheNameAndPercentage}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.stageName} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-3 gap-4">
          <Input label={t.crm.ranking} type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} required />
          <Input label={t.crm.colorHex} value={color} onChange={(e) => setColor(e.target.value)} required />
          <Input label={t.crm.successRate} value={winProbability} onChange={(e) => setWinProbability(e.target.value)} required />
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
