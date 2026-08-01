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
  onSubmit: (data: { settingName: string; key: string; value: string; group: "lead_routing" | "deal_limits" | "email_integration" | "security" }) => void;
}

export function CreateCrmModuleSettingsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [settingName, setSettingName] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [group, setGroup] = useState<"lead_routing" | "deal_limits" | "email_integration" | "security">("lead_routing");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingName || !key) return;
    onSubmit({ settingName, key, value, group });
    setSettingName("");
    setKey("");
    setValue("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addANewCRMModuleSetting} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.settingName} placeholder={t.crm.exampleAutomaticDealCancel} value={settingName} onChange={(e) => setSettingName(e.target.value)} required />
        <Input label={t.crm.softwareSetupKey} placeholder="crm.auto_cancel_days" value={key} onChange={(e) => setKey(e.target.value)} required />
        <Input label={t.crm.theAssignedValueValue} placeholder="30" value={value} onChange={(e) => setValue(e.target.value)} required />
        <Select
          label={t.crm.group}
          value={group}
          onChange={(e) => setGroup(e.target.value as any)}
          options={[
            { label: t.crm.leadRouting, value: "lead_routing" },
            { label: t.crm.dealLimits, value: "deal_limits" },
            { label: t.crm.emailIntegration, value: "email_integration" },
            { label: t.crm.security, value: "security" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveTheSetting}</Button>
        </div>
      </form>
    </Modal>
  );
}
