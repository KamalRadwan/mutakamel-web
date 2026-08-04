"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function CoreSignedFileGeneralPage() {
  const toast = useToast();
  const [bucket, setBucket] = useState("invoices");
  const [filename, setFilename] = useState("INV-2026-001.pdf");
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("07");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر والتفاصيل العامة</h2>
          <p className="text-xs text-slate-500">يمكنك تعديل بيانات الرابط وتحديث الحاوية مباشرة بدون فتح نوافذ خارجية</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الملف (Filename)" value={filename} onChange={(e) => setFilename(e.target.value)} required />
        <Select
          label="اسم الحاوية (Bucket)"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          options={[
            { label: "invoices", value: "invoices" },
            { label: "contracts", value: "contracts" },
            { label: "export-reports", value: "export-reports" },
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="السنة" value={year} onChange={(e) => setYear(e.target.value)} required />
          <Input label="الشهر" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التغييرات المباشرة</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
