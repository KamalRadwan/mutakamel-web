"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2, Send } from "lucide-react";

export default function NotificationConfigGeneralPage() {
  const [channel, setChannel] = useState("البريد الإلكتروني الرئيسي (SMTP)");
  const [senderEmail, setSenderEmail] = useState("noreply@tenant.mutakamel.ai");
  const [smtpHost, setSmtpHost] = useState("smtp.mailgun.org");
  const [port, setPort] = useState("587");
  const [isSaved, setIsSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestConnection = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لخادم البريد</h2>
          <p className="text-xs text-slate-500">قم بتحديث قيم خادم SMTP واختبار الاتصال المباشر</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم القناة" value={channel} onChange={(e) => setChannel(e.target.value)} required />
        <Input label="بريد المرسل" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="خادم SMTP Host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required />
          <Input label="المنفذ Port" value={port} onChange={(e) => setPort(e.target.value)} required />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات المباشرة</span>
          </Button>

          <Button type="button" variant="secondary" onClick={handleTestConnection}>
            <Send className="w-4 h-4" />
            <span>{testSent ? "جاري الإرسال التجريبي..." : "اختبار الاتصال بالخادم"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
