"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2, Sparkles } from "lucide-react";

export default function TradeAiGeneralPage() {
  const [guideTitle, setGuideTitle] = useState("دليل تسعير المنتجات التلقائي والخصم الكلي");
  const [moduleTarget, setModuleTarget] = useState("trade-app");
  const [aiPromptPattern, setAiPromptPattern] = useState("Calculate dynamic bulk discount based on order quantity");
  const [recommendedModel, setRecommendedModel] = useState("Gemini 1.5 Pro");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لدليل الذكاء الاصطناعي</h2>
          <p className="text-xs text-slate-500">تحديث النمط والنموذج الموصى به فورياً</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="عنوان الدليل" value={guideTitle} onChange={(e) => setGuideTitle(e.target.value)} required />
        <Input label="المكون المستهدف" value={moduleTarget} onChange={(e) => setModuleTarget(e.target.value)} required />
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">نمط الـ Prompt Pattern</label>
          <textarea
            rows={4}
            value={aiPromptPattern}
            onChange={(e) => setAiPromptPattern(e.target.value)}
            className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl"
          />
        </div>
        <Select
          label="النموذج الموصى به"
          value={recommendedModel}
          onChange={(e) => setRecommendedModel(e.target.value)}
          options={[
            { label: "Gemini 1.5 Pro", value: "Gemini 1.5 Pro" },
            { label: "Gemini Flash 1.5", value: "Gemini Flash 1.5" },
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
