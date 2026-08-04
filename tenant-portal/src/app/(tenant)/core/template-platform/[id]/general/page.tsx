"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, Eye } from "lucide-react";

export default function TemplateGeneralPage() {
  const toast = useToast();
  const [name, setName] = useState("قالب الفاتورة الإلكترونية الموحدة");
  const [category, setCategory] = useState("pdf");
  const [version, setVersion] = useState("v1.4.0");
  const [htmlContent, setHtmlContent] = useState("<div class='invoice-container'><h1>الفاتورة الإلكترونية</h1><p>{{invoice_number}}</p></div>");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">محرر القالب والتعديل المباشر</h2>
          <p className="text-xs text-slate-500">قم بتحديث كود القالب والمتغيرات الديناميكية direkt</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم القالب" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع القالب"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { label: "مستند طباعة (PDF)", value: "pdf" },
              { label: "بريد إلكتروني (Email)", value: "email" },
              { label: "كود HTML", value: "html" },
            ]}
          />
          <Input label="رقم الإصدار Version" value={version} onChange={(e) => setVersion(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">كود القالب HTML / Handlebars</label>
          <textarea
            rows={8}
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ القالب المباشر</span>
          </Button>

          <Button type="button" variant="secondary">
            <Eye className="w-4 h-4" />
            <span>معاينة الإخراج الفعلي</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
