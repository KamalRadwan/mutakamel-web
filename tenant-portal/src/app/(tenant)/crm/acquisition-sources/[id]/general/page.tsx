"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function SourceGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [name, setName] = useState(t.crm.googleAdsAndSearchCredit);
  const [channelType, setChannelType] = useState("digital");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directAdjustmentOfThePolar}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateNameAndChannelDirect}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.nameOfThePolarizationSourc} value={name} onChange={(e) => setName(e.target.value)} required />
        <Select
          label={t.crm.channelType}
          value={channelType}
          onChange={(e) => setChannelType(e.target.value)}
          options={[
            { label: t.crm.digitalMarketing, value: "digital" },
            { label: t.crm.recommendationNominationRef, value: "referral" },
            { label: t.crm.exhibitionConferenceEvent, value: "event" },
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
