"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string }) => void;
}

export function CreatePipelinesBoardsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState("b2b_custom_pipeline");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, code });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addANewSalesFunnelPipeli} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.salesFunnelName} placeholder={t.crm.exampleExternalExportPath} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t.crm.codeKey} value={code} onChange={(e) => setCode(e.target.value)} required />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveThePath}</Button>
        </div>
      </form>
    </Modal>
  );
}
