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
  onSubmit: (data: { title: string; methodPath: string; owningBackendApp: string; dtoValidation: string }) => void;
}

export function CreateCrmApiDocsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
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
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addAPIDocumentationForCRM} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.interfaceAddress} placeholder={t.crm.exampleFetchAListOfConta} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label={t.crm.pathAndMethod} value={methodPath} onChange={(e) => setMethodPath(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.crm.owningApp} value={owningBackendApp} onChange={(e) => setOwningBackendApp(e.target.value)} required />
          <Input label={t.crm.dTOValidationClass} value={dtoValidation} onChange={(e) => setDtoValidation(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveTheDocumentation}</Button>
        </div>
      </form>
    </Modal>
  );
}
