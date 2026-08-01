"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2, Play } from "lucide-react";

export default function ProvisioningUpdateGeneralPage() {
  const [version, setVersion] = useState("v2.4.0");
  const [targetComponent, setTargetComponent] = useState("Core Database Schema");
  const [releaseNotes, setReleaseNotes] = useState("تحديثات الأمان وتوسيع نطاق قاعدة بيانات المستأجر");
  const [isSaved, setIsSaved] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleApplyUpdate = () => {
    setIsApplying(true);
    setTimeout(() => setIsApplying(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر والتطبيق الفوري</h2>
          <p className="text-xs text-slate-500">قم بتحديث ملاحظات الإصدار وتنفيذ التحديث فورياً</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <Input label="رقم الإصدار Version" value={version} onChange={(e) => setVersion(e.target.value)} required />
          <Input label="المكون المستهدف" value={targetComponent} onChange={(e) => setTargetComponent(e.target.value)} required />
        </div>
        <Input label="ملاحظات الإصدار Release Notes" value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} required />

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ الملاحظات المباشرة</span>
          </Button>

          <Button type="button" variant="secondary" onClick={handleApplyUpdate}>
            <Play className="w-4 h-4 text-emerald-600" />
            <span>{isApplying ? "جاري تطبيق التحديث..." : "تطبيق التحديث الآن (Apply Update)"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
