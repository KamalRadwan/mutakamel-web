"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function WorkspaceGeneralPage() {
  const toast = useToast();
  const [tenantName, setTenantName] = useState("شركة متكامل كراود كابيتال");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState("/logo-mutakamel.png");
  const [defaultTimezone, setDefaultTimezone] = useState("Asia/Riyadh (GMT+3)");
  const [locale, setLocale] = useState("ar");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للهوية والبصمة البصرية</h2>
          <p className="text-xs text-slate-500">قم بتعديل لون العلامة التجارية، الشعار واللغة فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم مساحة العمل / المستأجر" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="اللون الرئيسي Hex" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} required />
          <Input label="رابط الشعار Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="المنطقة الزمنية" value={defaultTimezone} onChange={(e) => setDefaultTimezone(e.target.value)} required />
          <Select
            label="اللغة الافتراضية"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            options={[
              { label: "العربية (RTL)", value: "ar" },
              { label: "English (LTR)", value: "en" },
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
