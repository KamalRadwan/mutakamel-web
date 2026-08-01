"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; methodPath: string; owningBackendApp: string; dtoValidation: string }) => void;
}

export function CreateCrmApiDocsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [title, setTitle] = useState("");
  const [methodPath, setMethodPath] = useState("POST /api/tenant/crm/v1/contacts");
  const [owningBackendApp, setOwningBackendApp] = useState("crm-app");
  const [dtoValidation, setDtoValidation] = useState("CreateContactDto");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onSubmit({ title, methodPath, owningBackendApp, dtoValidation });
    setTitle("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة توثيق API لموديول CRM" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="عنوان الواجهة" placeholder="مثال: جلب قائمة الاتصالات" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label="المسار والـ Method" value={methodPath} onChange={(e) => setMethodPath(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="التطبيق الخلفي (Owning App)" value={owningBackendApp} onChange={(e) => setOwningBackendApp(e.target.value)} required />
          <Input label="فئة التحقق (DTO Validation)" value={dtoValidation} onChange={(e) => setDtoValidation(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ التوثيق</Button>
        </div>
      </form>
    </Modal>
  );
}
