"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2, Download } from "lucide-react";

export default function NoteGeneralPage() {
  const [title, setTitle] = useState("ملاحظات الاجتماع الأخير وعرض الأسعار الفني");
  const [targetType, setTargetType] = useState("deal");
  const [targetName, setTargetName] = useState("صفقة مستشفى الحياة");
  const [noteContent, setNoteContent] = useState("تم الاتفاق على تقديم خصم 5% مقابل السداد المباشر");
  const [attachmentName, setAttachmentName] = useState("Technical_Proposal_v2.pdf");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للملاحظة والمرفق</h2>
          <p className="text-xs text-slate-500">قم بتحديث نص الملاحظة والتنزيل المباشر للملف</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="عنوان الملاحظة" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع الكيان"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            options={[
              { label: "صفقة (Deal)", value: "deal" },
              { label: "عميل محتمل (Lead)", value: "lead" },
            ]}
          />
          <Input label="اسم الكيان" value={targetName} onChange={(e) => setTargetName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">محتوى الملاحظة</label>
          <textarea
            rows={4}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>
        <Input label="اسم الملف المرفق" value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} required />

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات المباشرة</span>
          </Button>

          <Button type="button" variant="secondary">
            <Download className="w-4 h-4" />
            <span>تحميل الملف المرفق</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
