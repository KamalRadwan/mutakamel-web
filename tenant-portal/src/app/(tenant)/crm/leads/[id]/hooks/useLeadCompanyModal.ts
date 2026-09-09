"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { splitPhoneNumber } from "@/lib/geo/country-data";
import type { LeadDetail } from "../../lead-contract";
import type { LeadAddressForm } from "../../lead-create-contract";
import type { LeadCompanyField } from "../../lead-write-contract";
import { CRM_PHONE_LIST_MAX } from "../../../shared/components/CrmPhoneListField";
import { useCrmFieldMessages } from "../../../shared/hooks/useCrmFieldMessages";
import {
  buildCompanyModalRequest, companyFormFromLead, companyFormIsDirty,
  validateCompanyForm, type LeadCompanyForm,
} from "../lead-company-modal-contract";
import type { LeadCompanyEdit } from "./useLeadCompanyEdit";

export function useLeadCompanyModal(lead: LeadDetail, edit: LeadCompanyEdit, readOnly: boolean) {
  const { t } = useI18n();
  const messages = useCrmFieldMessages();
  const [form, setForm] = useState<LeadCompanyForm | null>(null);
  const [baseline, setBaseline] = useState<LeadCompanyForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  const saving = edit.savingKey === "company";
  const canEditAddress = !lead.address || lead.address.addressType === "LEGAL";

  function open() {
    if (readOnly || inFlight.current) return;
    const initial = companyFormFromLead(lead);
    setBaseline(initial);
    setForm(initial);
    setErrors({});
    edit.clearError();
  }

  function close() {
    if (inFlight.current || saving) return;
    setForm(null);
    setBaseline(null);
    setErrors({});
    edit.clearError();
  }

  async function save() {
    if (!form || !baseline || readOnly || inFlight.current || saving || edit.reconciliationRequired) return;
    const nextErrors = validateCompanyForm(form, baseline, messages, t.crmLeadDetail.companyAddressClearUnavailable);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const request = buildCompanyModalRequest(form, baseline);
    if (Object.keys(request).length === 0) { close(); return; }
    inFlight.current = true;
    try {
      if (await edit.save("company", request)) {
        setForm(null);
        setBaseline(null);
      }
    } finally { inFlight.current = false; }
  }

  return {
    form, errors, saving, canEditAddress,
    isDirty: Boolean(form && baseline && companyFormIsDirty(form, baseline)),
    open, close, save,
    setField(field: LeadCompanyField, value: string) {
      setForm((current) => current ? { ...current, [field]: value } : current);
      setErrors((current) => { const next = { ...current }; delete next[field]; return next; });
    },
    setAddressField(field: keyof LeadAddressForm, value: string) {
      if (!canEditAddress) return;
      setForm((current) => current ? { ...current, address: { ...current.address, [field]: value } } : current);
      setErrors((current) => { const next = { ...current }; delete next.address; delete next[`address.${field}`]; return next; });
    },
    setPhone(index: number, value: string) {
      setForm((current) => current ? { ...current, phones: current.phones.map((phone, at) => at === index ? value : phone) } : current);
      setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("companyPhones."))));
    },
    addPhone() {
      setForm((current) => {
        if (!current || current.phones.length >= CRM_PHONE_LIST_MAX) return current;
        const inherited = current.phones.map((phone) => splitPhoneNumber(phone)?.callingCode ?? "").findLast(Boolean);
        return { ...current, phones: [...current.phones, inherited ?? ""] };
      });
    },
    removePhone(index: number) {
      setForm((current) => {
        if (!current) return current;
        const phones = current.phones.filter((_, at) => at !== index);
        return { ...current, phones: phones.length > 0 ? phones : [""] };
      });
      setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("companyPhones."))));
    },
  };
}

export type LeadCompanyModalState = ReturnType<typeof useLeadCompanyModal>;
