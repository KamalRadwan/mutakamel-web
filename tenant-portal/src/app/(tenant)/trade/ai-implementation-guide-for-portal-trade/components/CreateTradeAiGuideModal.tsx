"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { guideTitle: string; moduleTarget: string; aiPromptPattern: string; recommendedModel: string }) => void;
}

export function CreateTradeAiGuideModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [guideTitle, setGuideTitle] = useState("");
  const [moduleTarget, setModuleTarget] = useState("trade-app");
  const [aiPromptPattern, setAiPromptPattern] = useState("");
  const [recommendedModel, setRecommendedModel] = useState("Gemini 1.5 Pro");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideTitle) return;
    onSubmit({ guideTitle, moduleTarget, aiPromptPattern, recommendedModel });
    setGuideTitle("");
    setAiPromptPattern("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة دليل تطبيق الذكاء الاصطناعي لموديول التجارة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="عنوان الدليل" placeholder="مثال: دليل التنبؤ بالطلب الفصلي" value={guideTitle} onChange={(e) => setGuideTitle(e.target.value)} required />
        <Input label="المكون المستهدف Module" value={moduleTarget} onChange={(e) => setModuleTarget(e.target.value)} required />
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">نمط الـ Prompt الموصى به</label>
          <textarea
            rows={3}
            value={aiPromptPattern}
            onChange={(e) => setAiPromptPattern(e.target.value)}
            className="w-full p-2.5 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl"
            required
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
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الدليل</Button>
        </div>
      </form>
    </Modal>
  );
}
