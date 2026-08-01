"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function ApiDocGeneralPage() {
    const { t } = useI18n();
  const [title, setTitle] = useState(t.crm.bringAListOfPotentialClie);
  const [methodPath, setMethodPath] = useState("GET /api/tenant/crm/v1/leads");
  const [owningBackendApp, setOwningBackendApp] = useState("crm-app");
  const [dtoValidation, setDtoValidation] = useState("LeadQueryDto");
  const [isSaved, setIsSaved] = useState(false);

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationOfTheAPI}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateThePathAndNameOfTh}</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            {t.crm.changesHaveBeenSaved}</span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.interfaceAddress} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label={t.crm.pathAndMethod} value={methodPath} onChange={(e) => setMethodPath(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label={t.crm.backEndApplication} value={owningBackendApp} onChange={(e) => setOwningBackendApp(e.target.value)} required />
          <Input label={t.crm.dTOCategory} value={dtoValidation} onChange={(e) => setDtoValidation(e.target.value)} required />
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
