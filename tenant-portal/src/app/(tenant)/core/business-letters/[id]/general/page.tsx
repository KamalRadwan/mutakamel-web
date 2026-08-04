"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, FileText, Printer } from "lucide-react";

export default function BusinessLetterGeneralPage() {
  const toast = useToast();
  const [subject, setSubject] = useState("خطاب عدم مانع ونقل كفالة");
  const [recipient, setRecipient] = useState("وزارة الموارد البشرية");
  const [content, setContent] = useState("نفيدكم نحن شركة متكامل كراود كابيتال بأنه لا مانع لدينا من نقل كفالة المكفول المذكور أعلاه...");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">تحرير الخطاب والصياغة المباشرة</h2>
          <p className="text-xs text-slate-500">قم بتحديث نص وموضوع الخطاب ومعاينته مباشرة</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="موضوع الخطاب" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Input label="الجهة الموجه إليها" value={recipient} onChange={(e) => setRecipient(e.target.value)} required />

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">نص الخطاب</label>
          <textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ النص المعدل</span>
          </Button>
          <Button type="button" variant="secondary">
            <Printer className="w-4 h-4" />
            <span>معاينة وتصقير PDF</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
