"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { channel: string; senderEmail: string; smtpHost: string; port: number }) => void;
}

export function CreateNotificationsEmailConfigModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [channel, setChannel] = useState("البريد الإلكتروني للعمليات");
  const [senderEmail, setSenderEmail] = useState("ops@tenant.mutakamel.ai");
  const [smtpHost, setSmtpHost] = useState("smtp.sendgrid.net");
  const [port, setPort] = useState(587);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderEmail || !smtpHost) return;
    onSubmit({ channel, senderEmail, smtpHost, port: Number(port) });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إعداد قناة إشعارات / خادم بريد جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم القناة" value={channel} onChange={(e) => setChannel(e.target.value)} required />
        <Input label="بريد المرسل" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="عنوان خادم SMTP Host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required />
          <Input label="منفذ الاتصال Port" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الإعدادات</Button>
        </div>
      </form>
    </Modal>
  );
}
