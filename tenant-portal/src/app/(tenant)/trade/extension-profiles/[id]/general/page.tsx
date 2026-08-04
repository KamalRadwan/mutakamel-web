"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function ExtensionGeneralPage() {
  const toast = useToast();
  const [extensionName, setExtensionName] = useState("ملحق الحسابات والمراجعة المحاسبية الفورية");
  const [pluginId, setPluginId] = useState("ext-acc-auditor");
  const [moduleTarget, setModuleTarget] = useState("trade-app");
  const [version, setVersion] = useState("v2.4.0");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للملحق التوسعي</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم والإصدار فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الملحق" value={extensionName} onChange={(e) => setExtensionName(e.target.value)} required />
        <Input label="معرف الملحق Plugin ID" value={pluginId} onChange={(e) => setPluginId(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="المكون المستهدف" value={moduleTarget} onChange={(e) => setModuleTarget(e.target.value)} required />
          <Input label="الإصدار" value={version} onChange={(e) => setVersion(e.target.value)} required />
        </div>

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
