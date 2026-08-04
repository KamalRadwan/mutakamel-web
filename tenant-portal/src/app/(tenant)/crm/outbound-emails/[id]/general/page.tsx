"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function OutboundEmailGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [recipientName, setRecipientName] = useState(t.crm.d);
  const [recipientEmail, setRecipientEmail] = useState("info@alamal-med.com");
  const [subject, setSubject] = useState(t.crm.confirmTheTechnicalPresenta);

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationOfTheOut}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateTheMessageTitleAndR}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.futureName} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
        <Input label={t.crm.eMail} type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
        <Input label={t.crm.messageTitleSubject} value={subject} onChange={(e) => setSubject(e.target.value)} required />

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
