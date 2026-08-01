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
  onSubmit: (data: { name: string; category: "executive" | "sales_rep" | "marketing" | "operations" }) => void;
}

export function CreatePresetDashboardsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"executive" | "sales_rep" | "marketing" | "operations">("executive");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, category });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.createAPresetDashboard} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.presetName} placeholder={t.crm.exampleSeniorMarketingMana} value={name} onChange={(e) => setName(e.target.value)} required />
        <Select
          label={t.crm.classificationOfTargets}
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          options={[
            { label: t.crm.executiveManagement, value: "executive" },
            { label: t.crm.salesReps, value: "sales_rep" },
            { label: t.crm.marketingAndRecruitment, value: "marketing" },
            { label: t.crm.operationsAndSupport, value: "operations" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.createTheBoard}</Button>
        </div>
      </form>
    </Modal>
  );
}
