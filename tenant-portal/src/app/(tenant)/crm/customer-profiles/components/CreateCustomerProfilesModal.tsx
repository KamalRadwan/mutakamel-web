"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; category: "VIP" | "Enterprise" | "SME"; contactPerson: string; phone: string; email: string }) => void;
}

export function CreateCustomerProfilesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"VIP" | "Enterprise" | "SME">("Enterprise");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, category, contactPerson, phone, email });
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة ملف عميل جديد (Customer Profile)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الشركة / العميل" placeholder="مثال: شركة المجد للتجارة" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="تصنيف العميل"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            options={[
              { label: "كبار العملاء (VIP)", value: "VIP" },
              { label: "شركات كبرى (Enterprise)", value: "Enterprise" },
              { label: "شركات متوسطة (SME)", value: "SME" },
            ]}
          />
          <Input label="المسؤول المباشر" placeholder="أستاذ فهد" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="رقم الجوال" placeholder="+966 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label="البريد الإلكتروني" type="email" placeholder="client@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ العميل</Button>
        </div>
      </form>
    </Modal>
  );
}
