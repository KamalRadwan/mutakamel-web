"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function ImportWebhookGeneralPage() {
  const toast = useToast();
  const [name, setName] = useState("استيراد ملف المنتجات والتسعير المجمّع (CSV/XLSX)");
  const [targetEndpointOrFile, setTargetEndpointOrFile] = useState("products_bulk_import_2026.xlsx");
  const [type, setType] = useState("excel_import");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لعملية الاستيراد / Webhook</h2>
          <p className="text-xs text-slate-500">قم بتحديث اسم الإجراء ورابط الـ Webhook مباشرة</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم العملية" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="الرابط Target Endpoint / اسم الملف" value={targetEndpointOrFile} onChange={(e) => setTargetEndpointOrFile(e.target.value)} required />
        <Select
          label="النوع"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[
            { label: "استيراد ملفات (Excel Import)", value: "excel_import" },
            { label: "رابط صادر (Outbound Webhook)", value: "outbound_webhook" },
          ]}
        />

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات المباشرة</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
