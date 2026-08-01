"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmTaskGeneralPage() {
    const { t } = useI18n();
  const [subject, setSubject] = useState(t.crm.demoSessionForTheInventory);
  const [leadOrCustomer, setLeadOrCustomer] = useState(t.crm.alAmalMedicalSuppliesCompa);
  const [taskType, setTaskType] = useState("demo");
  const [dueDate, setDueDate] = useState("2026-07-28 11:00");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationOfTheTas}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateTheTopicAndDatesDir}</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            {t.crm.saved}</span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.taskTopic} value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Input label={t.crm.associatedClient} value={leadOrCustomer} onChange={(e) => setLeadOrCustomer(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.crm.typeOfEvent}
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            options={[
              { label: t.crm.demo, value: "demo" },
              { label: t.crm.call, value: "call" },
              { label: t.crm.businessMeeting, value: "meeting" },
            ]}
          />
          <Input label={t.crm.dateAndTime} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
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
