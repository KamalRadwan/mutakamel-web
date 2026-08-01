"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2, Download, Printer } from "lucide-react";

export default function PdfJobGeneralPage() {
  const [referenceNumber, setReferenceNumber] = useState("INV-2026-8801");
  const [templateName, setTemplateName] = useState("ZATCA_Tax_Invoice_Standard.html");
  const [documentType, setDocumentType] = useState("invoice");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لمهمة توليد ملف الـ PDF</h2>
          <p className="text-xs text-slate-500">قم بتحديث القالب والرقم المرجعي والتحميل مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="رقم المستند المرجعي" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} required />
        <Input label="قالب HTML المستعمل" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
        <Select
          label="نوع المستند"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          options={[
            { label: "فاتورة ضريبية (Tax Invoice)", value: "invoice" },
            { label: "عرض سعر (Quotation)", value: "quotation" },
          ]}
        />

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات المباشرة</span>
          </Button>
          <Button type="button" variant="secondary">
            <Download className="w-4 h-4" />
            <span>تحميل ملف الـ PDF المعالج</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
