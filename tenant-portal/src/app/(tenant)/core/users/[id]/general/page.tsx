"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function UserGeneralPage() {
  const toast = useToast();
  const [fullName, setFullName] = useState("منى علي");
  const [email, setEmail] = useState("mona@tenant.mutakamel.ai");
  const [phone, setPhone] = useState("+966 50 111 2233");
  const [roleName, setRoleName] = useState("مدير المستأجر الأخصائي");
  const [branch, setBranch] = useState("المركز الرئيسي");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لحساب المستخدم</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم، الجوال والدور فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="رقم الجوال" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="الدور الوظيفي"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            options={[
              { label: "مدير المستأجر الأخصائي", value: "مدير المستأجر الأخصائي" },
              { label: "مدير المبيعات والعملاء", value: "مدير المبيعات والعملاء" },
            ]}
          />
          <Select
            label="الفرع"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            options={[
              { label: "المركز الرئيسي", value: "المركز الرئيسي" },
              { label: "فرع الرياض الرئيسي", value: "فرع الرياض الرئيسي" },
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
