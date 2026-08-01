"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; channelType: "digital" | "referral" | "event" | "cold_call" }) => void;
}

export function CreateAcquisitionSourcesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<"digital" | "referral" | "event" | "cold_call">("digital");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, channelType });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة مصدر استقطاب عملاء جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم مصدر الاستقطاب" placeholder="مثال: حملة لينكدإن Q3" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select
          label="نوع القناة"
          value={channelType}
          onChange={(e) => setChannelType(e.target.value as any)}
          options={[
            { label: "تسويق رقمي (Digital)", value: "digital" },
            { label: "توصية / ترشيح (Referral)", value: "referral" },
            { label: "معرض / مؤتمر (Event)", value: "event" },
            { label: "اتصال بارد (Cold Call)", value: "cold_call" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ المصدر</Button>
        </div>
      </form>
    </Modal>
  );
}
