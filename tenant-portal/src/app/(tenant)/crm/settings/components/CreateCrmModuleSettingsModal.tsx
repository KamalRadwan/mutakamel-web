"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { settingName: string; key: string; value: string; group: "lead_routing" | "deal_limits" | "email_integration" | "security" }) => void;
}

export function CreateCrmModuleSettingsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [settingName, setSettingName] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [group, setGroup] = useState<"lead_routing" | "deal_limits" | "email_integration" | "security">("lead_routing");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingName || !key) return;
    onSubmit({ settingName, key, value, group });
    setSettingName("");
    setKey("");
    setValue("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة إعداد موديول CRM جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الإعداد" placeholder="مثال: مهلة إلغاء الصفقة التلقائي" value={settingName} onChange={(e) => setSettingName(e.target.value)} required />
        <Input label="مفتاح الإعداد البرمجي Key" placeholder="crm.auto_cancel_days" value={key} onChange={(e) => setKey(e.target.value)} required />
        <Input label="القيمة المعينة Value" placeholder="30" value={value} onChange={(e) => setValue(e.target.value)} required />
        <Select
          label="المجموعة"
          value={group}
          onChange={(e) => setGroup(e.target.value as any)}
          options={[
            { label: "توزيع العملاء (Lead Routing)", value: "lead_routing" },
            { label: "حدود الصفقات (Deal Limits)", value: "deal_limits" },
            { label: "ربط البريد (Email Integration)", value: "email_integration" },
            { label: "الأمان والسرية (Security)", value: "security" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الإعداد</Button>
        </div>
      </form>
    </Modal>
  );
}
