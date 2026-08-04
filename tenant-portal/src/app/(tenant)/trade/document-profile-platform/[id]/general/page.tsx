"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function DocumentProfileGeneralPage() {
  const toast = useToast();
  const [profileName, setProfileName] = useState("ملف الفاتورة الضريبية المبسطة ZATCA B2C");
  const [documentCategory, setDocumentCategory] = useState("tax_invoice");
  const [zatcaPhase, setZatcaPhase] = useState("Phase 2 Reporting");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للبروفايل المستندي</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم ومرحلة الربط فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم البروفايل المستندي" value={profileName} onChange={(e) => setProfileName(e.target.value)} required />
        <Select
          label="فئة المستند"
          value={documentCategory}
          onChange={(e) => setDocumentCategory(e.target.value)}
          options={[
            { label: "فاتورة ضريبية (Tax Invoice)", value: "tax_invoice" },
            { label: "بيان جمركي (Customs Declaration)", value: "customs_declaration" },
          ]}
        />
        <Select
          label="مرحلة ZATCA"
          value={zatcaPhase}
          onChange={(e) => setZatcaPhase(e.target.value)}
          options={[
            { label: "Phase 2 Reporting", value: "Phase 2 Reporting" },
            { label: "Phase 2 Clearance", value: "Phase 2 Clearance" },
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
