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
  onSubmit: (data: { name: string; channelType: "digital" | "referral" | "event" | "cold_call" }) => void;
}

export function CreateAcquisitionSourcesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<"digital" | "referral" | "event" | "cold_call">("digital");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, channelType });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addingANewCustomerAttracti} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.nameOfThePolarizationSourc} placeholder={t.crm.exampleLinkedInQ3Campaign} value={name} onChange={(e) => setName(e.target.value)} required />
        <Select
          label={t.crm.channelType}
          value={channelType}
          onChange={(e) => setChannelType(e.target.value as any)}
          options={[
            { label: t.crm.digitalMarketing, value: "digital" },
            { label: t.crm.recommendationNominationRef, value: "referral" },
            { label: t.crm.exhibitionConferenceEvent, value: "event" },
            { label: t.crm.coldCall, value: "cold_call" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveTheSource}</Button>
        </div>
      </form>
    </Modal>
  );
}
