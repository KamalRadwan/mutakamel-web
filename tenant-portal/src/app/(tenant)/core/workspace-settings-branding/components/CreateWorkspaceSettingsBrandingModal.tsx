"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { tenantName: string; primaryColor: string; logoUrl: string; defaultTimezone: string; locale: "ar" | "en" }) => void;
}

export function CreateWorkspaceSettingsBrandingModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [tenantName, setTenantName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState("/logo-default.png");
  const [defaultTimezone, setDefaultTimezone] = useState("Asia/Riyadh (GMT+3)");
  const [locale, setLocale] = useState<"ar" | "en">("ar");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName) return;
    onSubmit({ tenantName, primaryColor, logoUrl, defaultTimezone, locale });
    setTenantName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة وترسية هوية مساحة عمل جديدة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم مساحة العمل / المستأجر" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="اللون الرئيسي للعلامة (Color Hex)" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} required />
          <Input label="رابط الشعار Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="المنطقة الزمنية" value={defaultTimezone} onChange={(e) => setDefaultTimezone(e.target.value)} required />
          <Select
            label="اللغة الافتراضية"
            value={locale}
            onChange={(e) => setLocale(e.target.value as "ar" | "en")}
            options={[
              { label: "العربية (Arabic)", value: "ar" },
              { label: "English", value: "en" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الهوية</Button>
        </div>
      </form>
    </Modal>
  );
}
