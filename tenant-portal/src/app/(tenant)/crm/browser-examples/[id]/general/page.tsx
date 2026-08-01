"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2, Play } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function BrowserExampleGeneralPage() {
    const { t } = useI18n();
  const [name, setName] = useState(t.crm.visitorRegistrationFormFrom);
  const [targetEndpoint, setTargetEndpoint] = useState("/api/tenant/crm/v1/leads/public");
  const [samplePayload, setSamplePayload] = useState(t.crm.nameAhmedPhone966);
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.liveEditingAndLiveRecallT}</h2>
          <p className="text-xs text-slate-500">{t.crm.adjustThePayloadAndExperie}</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            {t.crm.theFormHasBeenSaved}</span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.modelName} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t.crm.targetEndpoint} value={targetEndpoint} onChange={(e) => setTargetEndpoint(e.target.value)} required />
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{t.crm.samplePayload}</label>
          <textarea
            rows={4}
            value={samplePayload}
            onChange={(e) => setSamplePayload(e.target.value)}
            className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>{t.crm.saveLiveEdits}</span>
          </Button>

          <Button type="button" variant="secondary">
            <Play className="w-4 h-4 text-emerald-600" />
            <span>{t.crm.submitADemoRequestNow}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
