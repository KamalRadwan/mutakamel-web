"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { letterNumber: string; subject: string; recipient: string; templateType: string }) => void;
}

export function CreateBusinessLettersModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [letterNumber, setLetterNumber] = useState(`LTR-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [subject, setSubject] = useState("");
  const [recipient, setRecipient] = useState("");
  const [templateType, setTemplateType] = useState("خطاب رسمي موجه");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !recipient) return;
    onSubmit({ letterNumber, subject, recipient, templateType });
    setSubject("");
    setRecipient("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إصدار خطاب تجاري / رسمي جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="رقم الخطاب" value={letterNumber} onChange={(e) => setLetterNumber(e.target.value)} required />
        <Input label="موضوع الخطاب" placeholder="مثال: خطاب شهادة تعريف بالراتب" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Input label="الجهة الموجه إليها" placeholder="مثال: وزارة الموارد البشرية" value={recipient} onChange={(e) => setRecipient(e.target.value)} required />
        <Select
          label="نوع القالب"
          value={templateType}
          onChange={(e) => setTemplateType(e.target.value)}
          options={[
            { label: "خطاب رسمي موجه", value: "خطاب رسمي موجه" },
            { label: "شهادة تعريف بالراتب", value: "شهادة تعريف بالراتب" },
            { label: "تفويض رسمي", value: "تفويض رسمي" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ المسودة</Button>
        </div>
      </form>
    </Modal>
  );
}
