"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; partyType: "individual" | "organization"; phone: string; email: string; roles: string[] }) => void;
}

export function CreatePartyDirectoryModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [partyType, setPartyType] = useState<"individual" | "organization">("organization");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roleInput, setRoleInput] = useState("عميل تجاري");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, partyType, phone, email, roles: [roleInput] });
    setName("");
    setPhone("");
    setEmail("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة جهة جديدة لدفتر العناوين (Party Directory)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="الاسم الكامل للجهة / الفرد" placeholder="شركة المجد أو الأستاذ فهد" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع الجهة"
            value={partyType}
            onChange={(e) => setPartyType(e.target.value as typeof partyType)}
            options={[
              { label: "منظمة / شركة (Organization)", value: "organization" },
              { label: "فرد / شخص (Individual)", value: "individual" },
            ]}
          />
          <Input label="الدور / التصنيف" value={roleInput} onChange={(e) => setRoleInput(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="رقم الهاتف" placeholder="+966 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label="البريد الإلكتروني" type="email" placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إضافة الجهة</Button>
        </div>
      </form>
    </Modal>
  );
}
