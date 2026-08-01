"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { userName: string; userEmail: string; moduleKey: string; moduleName: string }) => void;
}

export function CreateUserModuleAssignmentsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [userName, setUserName] = useState("فهد الشمري");
  const [userEmail, setUserEmail] = useState("fahad@tenant.com");
  const [moduleKey, setModuleKey] = useState("crm");

  const moduleNames: Record<string, string> = {
    core: "النظام الأساسي (Core System)",
    crm: "إدارة العملاء (CRM Module)",
    trade: "التجارة والعمليات (Trade Module)",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail) return;
    onSubmit({ userName, userEmail, moduleKey, moduleName: moduleNames[moduleKey] });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ربط وإسناد موديول لمستخدم" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم المستخدم" value={userName} onChange={(e) => setUserName(e.target.value)} required />
        <Input label="البريد الإلكتروني" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
        <Select
          label="الموديول المراد ربطه"
          value={moduleKey}
          onChange={(e) => setModuleKey(e.target.value)}
          options={[
            { label: "إدارة العملاء (CRM Module)", value: "crm" },
            { label: "التجارة والعمليات (Trade Module)", value: "trade" },
            { label: "النظام الأساسي (Core System)", value: "core" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">تأكيد التخصيص</Button>
        </div>
      </form>
    </Modal>
  );
}
