"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; description: string }) => void;
}

export function CreateRolesRoleAssignmentsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("tenant.custom_role");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, code, description });
    setName("");
    setDescription("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة دور وصلاحية جديدة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الدور" placeholder="مثال: مسؤول المحاسبة" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="كود الدور البرمجي" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Input label="وصف الدور والمسؤوليات" value={description} onChange={(e) => setDescription(e.target.value)} required />

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الدور</Button>
        </div>
      </form>
    </Modal>
  );
}
