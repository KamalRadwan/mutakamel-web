"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, Download } from "lucide-react";

export default function PdfJobGeneralPage() {
  const toast = useToast();
  const [referenceNumber, setReferenceNumber] = useState("INV-2026-8801");
  const [templateName, setTemplateName] = useState("ZATCA_Tax_Invoice_Standard.html");
  const [documentType, setDocumentType] = useState("invoice");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لمهمة توليد ملف الـ PDF</h2>
          <p className="text-xs text-slate-500">قم بتحديث القالب والرقم المرجعي والتحميل مباشرة</p>
        </div>
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
