"use client";

import { useState } from "react";
import { Field, FormDrawer, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { useLeadCompanyOptions } from "../hooks/useLeadCompanyOptions";
import type { CreateLeadFormData, LeadStage } from "../hooks/useLeads";
import { ExistingCompanyPicker } from "./ExistingCompanyPicker";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: LeadStage[];
  branchId: string | null;
  onSubmit: (data: CreateLeadFormData) => Promise<boolean>;
  error: string | null;
}

const initialForm: CreateLeadFormData = {
  contactName: "",
  companyName: "",
  email: "",
  phone: "",
  stageId: "",
  existingCompanyPartyId: "",
  contactPartyId: "",
};

export function CreateLeadsModal({ isOpen, onClose, onSubmit, stages, branchId, error }: CreateModalProps) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState<CreateLeadFormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const companyOptions = useLeadCompanyOptions(branchId, isOpen);

  const close = () => {
    setForm(initialForm);
    companyOptions.reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.contactName.trim() || !form.companyName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (await onSubmit(form)) setForm(initialForm);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.crmLeads.addTitle}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      error={error ?? undefined}
      labels={{
        submit: isSubmitting ? t.crmLeads.creating : t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <ExistingCompanyPicker
          options={companyOptions}
          existingCompanyPartyId={form.existingCompanyPartyId ?? ""}
          contactPartyId={form.contactPartyId ?? ""}
          disabled={isSubmitting}
          onCompanyChange={(existingCompanyPartyId, displayName) =>
            setForm((current) => ({
              ...current,
              existingCompanyPartyId,
              contactPartyId: "",
              companyName: displayName || current.companyName,
            }))
          }
          onContactChange={(contactPartyId, displayName, contactEmail, contactPhone) =>
            setForm((current) => ({
              ...current,
              contactPartyId,
              contactName: displayName || current.contactName,
              email: contactEmail || current.email,
              phone: contactPhone || current.phone,
            }))
          }
        />
        <Field label={t.crmLeads.contactName} required>
          <Input
            value={form.contactName}
            onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
            maxLength={180}
            required
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.crmLeads.companyName} required>
          <Input
            value={form.companyName}
            onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
            maxLength={180}
            required
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.crmLeads.email} required>
          <Input
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            maxLength={180}
            required
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.crmLeads.phone} required>
          <Input
            dir="ltr"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            maxLength={32}
            required
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.crmLeads.stage}>
          <Select
            value={form.stageId}
            onValueChange={(value) => setForm((current) => ({ ...current, stageId: value }))}
          >
            <SelectTrigger disabled={isSubmitting}>
              <SelectValue placeholder={t.crmLeads.defaultStage} />
            </SelectTrigger>
            <SelectContent>
              {stages
                .filter((stage) => stage.flag !== "CONVERTED")
                .map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {localizedName(stage, lang)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormDrawer>
  );
}
