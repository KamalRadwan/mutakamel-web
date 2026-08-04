"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function WorkflowVersionGeneralPage() {
  const toast = useToast();
  const [workflowName, setWorkflowName] = useState("دورة اعتماد الفواتير الضريبية ذات القيمة المرتفعة");
  const [versionNumber, setVersionNumber] = useState("v3.2.0");
  const [targetDocumentType, setTargetDocumentType] = useState("Sales Order");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لإصدار مسار العمل</h2>
          <p className="text-xs text-slate-500">قم بتحديث اسم المسار ورقم الإصدار والمستند المستهدف فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم مسار العمل" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="رقم الإصدار Version" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} required />
          <Select
            label="المستند المستهدف"
            value={targetDocumentType}
            onChange={(e) => setTargetDocumentType(e.target.value)}
            options={[
              { label: "أوامر المبيعات (Sales Order)", value: "Sales Order" },
              { label: "أوامر الشراء (Purchase Order)", value: "Purchase Order" },
            ]}
          />
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
