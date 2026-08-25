"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";
import type {
  CreateLeadFormData,
  LeadStage,
} from "../hooks/useLeads";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: LeadStage[];
  onSubmit: (data: CreateLeadFormData) => Promise<boolean>;
  error: string | null;
}

export function CreateLeadsModal({
  isOpen,
  onClose,
  onSubmit,
  stages,
  error,
}: CreateModalProps) {
  const { t, lang } = useI18n();
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stageId, setStageId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !companyName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await onSubmit({
        contactName,
        companyName,
        email,
        phone,
        ...(stageId ? { stageId } : {}),
      });
      if (created) {
        setContactName("");
        setCompanyName("");
        setEmail("");
        setPhone("");
        setStageId("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSubmitting}
      title={t.crm.addANewLead}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.nameOfPotentialCustomer} placeholder={t.crm.exampleDr} value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={180} required />
        <Input label={t.crm.nameOfTheCompanyEntity} placeholder={t.crm.alHayatHospital} value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={180} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.crm.eMail} type="email" placeholder="lead@company.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={180} required />
          <Input label={t.crm.mobileNumber} placeholder="+966 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} required />
        </div>
        <Select
          label={t.crm.initialStage}
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          options={[
            {
              label: lang === "ar" ? "المرحلة الافتراضية" : "Default stage",
              value: "",
            },
            ...stages
              .filter((stage) => stage.flag !== "CONVERTED")
              .map((stage) => ({
                label: lang === "ar" ? stage.nameAr : stage.nameEn,
                value: stage.id,
              })),
          ]}
        />
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>{t.crm.saveThePotentialCustomer}</Button>
        </div>
      </form>
    </Modal>
  );
}
