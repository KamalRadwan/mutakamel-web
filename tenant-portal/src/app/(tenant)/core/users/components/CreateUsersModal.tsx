"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { fullName: string; email: string; phone: string; roleName: string; branch: string }) => void;
}

export function CreateUsersModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleName, setRoleName] = useState("مدير المبيعات والعملاء");
  const [branch, setBranch] = useState("فرع الرياض الرئيسي");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;
    onSubmit({ fullName, email, phone, roleName, branch });
    setFullName("");
    setEmail("");
    setPhone("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="دعوة / إضافة مستخدم جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="الاسم الكامل" placeholder="مثال: خالد العتيبي" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="البريد الإلكتروني" type="email" placeholder="khaled@tenant.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="رقم الجوال" placeholder="+966 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="الدور الوظيفي"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            options={[
              { label: "مدير المبيعات والعملاء", value: "مدير المبيعات والعملاء" },
              { label: "أخصائي المخزون والتجارة", value: "أخصائي المخزون والتجارة" },
              { label: "مدير المستأجر الأخصائي", value: "مدير المستأجر الأخصائي" },
            ]}
          />
          <Select
            label="الفرع التابع"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            options={[
              { label: "فرع الرياض الرئيسي", value: "فرع الرياض الرئيسي" },
              { label: "المركز الرئيسي", value: "المركز الرئيسي" },
              { label: "فرع جدة", value: "فرع جدة" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إرسال الدعوة</Button>
        </div>
      </form>
    </Modal>
  );
}
