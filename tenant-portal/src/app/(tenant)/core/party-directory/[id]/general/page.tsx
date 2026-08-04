"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function PartyGeneralPage() {
  const toast = useToast();
  const [name, setName] = useState("شركة الأمل للتوريدات الطبية");
  const [partyType, setPartyType] = useState("organization");
  const [phone, setPhone] = useState("+966 50 123 4567");
  const [email, setEmail] = useState("info@alamal-med.com");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لبيانات الجهة</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم، بيانات التواصل، والتصنيف مباشرة</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الجهة / الفرد" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع الكيان"
            value={partyType}
            onChange={(e) => setPartyType(e.target.value)}
            options={[
              { label: "منظمة / شركة (Organization)", value: "organization" },
              { label: "فرد (Individual)", value: "individual" },
            ]}
          />
          <Input label="الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <Input label="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

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
