"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { recipientEmail: string; recipientName: string; subject: string; templateUsed: string }) => void;
}

export function CreateOutboundEmailsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [templateUsed, setTemplateUsed] = useState(t.crm.tmpl102WelcomeAndAppointm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !subject) return;
    onSubmit({ recipientEmail, recipientName, subject, templateUsed });
    setRecipientEmail("");
    setRecipientName("");
    setSubject("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.sendANewEmailMessage} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.crm.futureName} placeholder={t.crm.professorFahd} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
          <Input label={t.crm.eMail} type="email" placeholder="client@domain.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
        </div>
        <Input label={t.crm.subject} placeholder={t.crm.followUpOnTheTechnicalPre} value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Select
          label={t.crm.theTemplateUsed}
          value={templateUsed}
          onChange={(e) => setTemplateUsed(e.target.value)}
          options={[
            { label: t.crm.tmpl102WelcomeAndAppointm, value: t.crm.tmpl102WelcomeAndAppointm },
            { label: t.crm.tmpl101InvoiceAndContra, value: t.crm.tmpl101InvoiceAndContra },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.sendMail}</Button>
        </div>
      </form>
    </Modal>
  );
}
