"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { recipientEmail: string; recipientName: string; subject: string; templateUsed: string }) => void;
}

export function CreateOutboundEmailsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [templateUsed, setTemplateUsed] = useState("tmpl-102 (الترحيب والمواعيد)");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !subject) return;
    onSubmit({ recipientEmail, recipientName, subject, templateUsed });
    setRecipientEmail("");
    setRecipientName("");
    setSubject("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إرسال رسالة بريد إلكتروني جديدة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="اسم المستقبل" placeholder="أستاذ فهد" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
          <Input label="البريد الإلكتروني" type="email" placeholder="client@domain.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
        </div>
        <Input label="عنوان الرسالة (Subject)" placeholder="متابعة العرض الفني" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Select
          label="القالب المستعمل"
          value={templateUsed}
          onChange={(e) => setTemplateUsed(e.target.value)}
          options={[
            { label: "tmpl-102 (الترحيب والمواعيد)", value: "tmpl-102 (الترحيب والمواعيد)" },
            { label: "tmpl-101 (الفاتورة والعقد)", value: "tmpl-101 (الفاتورة والعقد)" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إرسال البريد</Button>
        </div>
      </form>
    </Modal>
  );
}
