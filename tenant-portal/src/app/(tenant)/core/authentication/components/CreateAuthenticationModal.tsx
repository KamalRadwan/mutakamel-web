"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { userEmail: string; ipAddress: string; device: string }) => void;
}

export function CreateAuthenticationModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [userEmail, setUserEmail] = useState("");
  const [ipAddress, setIpAddress] = useState("197.38.12.4");
  const [device, setDevice] = useState("Chrome on macOS");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;
    onSubmit({ userEmail, ipAddress, device });
    setUserEmail("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء وتوثيق جلسة جديدة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="البريد الإلكتروني للمستخدم" placeholder="user@tenant.com" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
        <Input label="عنوان الـ IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} required />
        <Input label="نوع الجهاز والمتصفح" value={device} onChange={(e) => setDevice(e.target.value)} required />

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">تأكيد الجلسة</Button>
        </div>
      </form>
    </Modal>
  );
}
