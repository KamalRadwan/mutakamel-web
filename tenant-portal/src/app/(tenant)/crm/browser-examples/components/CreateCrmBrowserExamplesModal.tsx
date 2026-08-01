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
  onSubmit: (data: { name: string; targetEndpoint: string; samplePayload: string; httpStatusExpected: number; environment: "sandbox" | "production" }) => void;
}

export function CreateCrmBrowserExamplesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [name, setName] = useState("");
  const [targetEndpoint, setTargetEndpoint] = useState("/api/tenant/crm/v1/leads");
  const [samplePayload, setSamplePayload] = useState('{"key": "value"}');
  const [httpStatusExpected, setHttpStatusExpected] = useState(200);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, targetEndpoint, samplePayload, httpStatusExpected: Number(httpStatusExpected), environment });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addABrowserCallFormBrows} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.modelName} placeholder={t.crm.exampleRegisterALiveLead} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t.crm.targetEndpoint} value={targetEndpoint} onChange={(e) => setTargetEndpoint(e.target.value)} required />
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{t.crm.samplePayloadJSON}</label>
          <textarea
            rows={3}
            value={samplePayload}
            onChange={(e) => setSamplePayload(e.target.value)}
            className="w-full p-2.5 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.crm.expectedResponseCode} type="number" value={httpStatusExpected} onChange={(e) => setHttpStatusExpected(Number(e.target.value))} required />
          <Select
            label={t.crm.theEnvironment}
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as any)}
            options={[
              { label: t.crm.experimentalSandbox, value: "sandbox" },
              { label: t.crm.productivity, value: "production" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveTheForm}</Button>
        </div>
      </form>
    </Modal>
  );
}
