"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type { ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmErrorBag } from "../../../shared/crm-form-validation";
import { useCrmFieldMessages } from "../../../shared/hooks/useCrmFieldMessages";
import { useLeadCompanyOptions } from "../../hooks/useLeadCompanyOptions";
import { LEAD_CREATE_LIMITS, type CreateLeadRequest } from "../../lead-create-contract";
import type { LeadBoardQuickAddProps } from "./lead-board-types";

export function useLeadBoardQuickAdd({ stage, branchId, sources, onCancel, onOpenFullModal, onSubmit }: LeadBoardQuickAddProps) {
  const { t, lang } = useI18n();
  const fieldMessages = useCrmFieldMessages();

  const [profileType, setProfileType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [individualPhones, setIndividualPhones] = useState<string[]>([""]);

  const [companyMode, setCompanyMode] = useState<"new" | "existing">("new");
  const [existingCompanyPartyId, setExistingCompanyPartyId] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [companyPhones, setCompanyPhones] = useState<string[]>([""]);
  const [contactPhones, setContactPhones] = useState<string[]>([""]);

  const [sourceId, setSourceId] = useState("");
  const [rating, setRating] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyLookup = useLeadCompanyOptions(branchId, profileType === "CORPORATE");

  const companyComboboxOptions = useMemo<ComboboxOption[]>(() => {
    return companyLookup.companies
      .map((c) => ({
        value: c.id,
        label: c.displayName,
        description: c.legalName ?? c.organizationName ?? undefined,
      }));
  }, [companyLookup.companies]);

  const selectedCompany = useMemo(
    () => companyLookup.selectedCompany ?? companyLookup.companies.find((c) => c.id === existingCompanyPartyId) ?? null,
    [companyLookup.selectedCompany, companyLookup.companies, existingCompanyPartyId],
  );

  function clearError(prefix: string) {
    setErrors((prev) => {
      if (!Object.keys(prev).some((k) => k === prefix || k.startsWith(`${prefix}.`))) {
        return prev;
      }
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (k !== prefix && !k.startsWith(`${prefix}.`)) {
          next[k] = v;
        }
      }
      return next;
    });
  }

  function handleOpenFullModal() {
    onOpenFullModal({
      leadProfileType: profileType,
      stageId: stage.id,
      acquisitionSourceId: sourceId,
      firstName,
      lastName,
      phones: individualPhones.length > 0 ? [...individualPhones] : [""],
      existingCompanyPartyId: companyMode === "existing" ? existingCompanyPartyId : "",
      companyName:
        companyMode === "existing"
          ? selectedCompany?.displayName || selectedCompanyName || ""
          : companyName,
      companyPhones:
        companyMode === "new" && companyPhones.length > 0 ? [...companyPhones] : [""],
      contactFirstName,
      contactLastName,
      contactPhones: contactPhones.length > 0 ? [...contactPhones] : [""],
    });
  }

  async function handleQuickSave() {
    if (isSubmitting) return;

    const bag = new CrmErrorBag(fieldMessages);
    bag.required("acquisitionSourceId", sourceId);

    if (profileType === "CORPORATE") {
      if (companyMode === "existing") {
        bag.required("existingCompanyPartyId", existingCompanyPartyId);
      } else {
        if (bag.required("companyName", companyName)) {
          bag.maxLength("companyName", companyName, LEAD_CREATE_LIMITS.companyName);
        }
        bag.phones("companyPhones", companyPhones);
      }

      if (bag.required("contactFirstName", contactFirstName)) {
        bag.maxLength("contactFirstName", contactFirstName, LEAD_CREATE_LIMITS.firstName);
      }
      bag.maxLength("contactLastName", contactLastName, LEAD_CREATE_LIMITS.lastName);
      bag.phones("contactPhones", contactPhones);
    } else {

      if (bag.required("firstName", firstName)) {
        bag.maxLength("firstName", firstName, LEAD_CREATE_LIMITS.firstName);
      }
      bag.maxLength("lastName", lastName, LEAD_CREATE_LIMITS.lastName);
      bag.phones("phones", individualPhones);
    }

    if (Object.keys(bag.errors).length > 0) {
      setErrors(bag.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      let payload: CreateLeadRequest;

      if (profileType === "CORPORATE") {
        const cleanCompanyPhones = companyPhones
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        const cleanContactPhones = contactPhones
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        const contactEntry = {
          firstName: contactFirstName.trim(),
          ...(contactLastName.trim() ? { lastName: contactLastName.trim() } : {}),
          isPrimary: true as const,
          ...(cleanContactPhones.length > 0 ? { phones: cleanContactPhones } : {}),
        };

        payload =
          companyMode === "existing"
            ? {
              branchId,
              leadProfileType: "CORPORATE",
              stageId: stage.id,
              existingCompanyPartyId,
              ...(sourceId ? { acquisitionSourceId: sourceId } : {}),
              contacts: [contactEntry],
            }
            : {
              branchId,
              leadProfileType: "CORPORATE",
              stageId: stage.id,
              companyName: companyName.trim(),
              ...(cleanCompanyPhones.length > 0 ? { companyPhones: cleanCompanyPhones } : {}),
              ...(sourceId ? { acquisitionSourceId: sourceId } : {}),
              contacts: [contactEntry],
            };
      } else {
        const cleanIndividualPhones = individualPhones
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        payload = {
          branchId,
          leadProfileType: "INDIVIDUAL",
          stageId: stage.id,
          firstName: firstName.trim(),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          ...(cleanIndividualPhones.length > 0 ? { phones: cleanIndividualPhones } : {}),
          ...(sourceId ? { acquisitionSourceId: sourceId } : {}),
        };
      }

      await onSubmit(payload, rating);
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeText(field: "firstName" | "lastName" | "companyName" | "contactFirstName" | "contactLastName" | "acquisitionSourceId", value: string) {
    const setters = {
      firstName: setFirstName, lastName: setLastName, companyName: setCompanyName,
      contactFirstName: setContactFirstName, contactLastName: setContactLastName, acquisitionSourceId: setSourceId
    };
    setters[field](value);
    clearError(field);
  }
  function changeProfileType(value: "INDIVIDUAL" | "CORPORATE") {
    setProfileType(value);
    setErrors({});
  }
  function changeCompanyMode(value: "new" | "existing") {
    setCompanyMode(value);
    if (value === "new") {
      setExistingCompanyPartyId("");
      setSelectedCompanyName("");
      companyLookup.searchCompanies("");
      companyLookup.selectCompany(null);
    }
    setErrors({});
  }
  function changeExistingCompany(id: string | null | undefined) {
    const nextId = id ?? "";
    const matched = companyLookup.companies.find((company) => company.id === nextId);
    setExistingCompanyPartyId(nextId);
    setSelectedCompanyName(matched?.displayName ?? "");
    companyLookup.searchCompanies("");
    companyLookup.selectCompany(nextId || null);
    clearError("existingCompanyPartyId");
  }
  type PhoneField = "phones" | "companyPhones" | "contactPhones";
  function updatePhones(field: PhoneField, update: (current: string[]) => string[]) {
    const setters = { phones: setIndividualPhones, companyPhones: setCompanyPhones, contactPhones: setContactPhones };
    setters[field](update);
  }
  function changePhone(field: PhoneField, index: number, value: string) {
    updatePhones(field, (current) => current.map((phone, position) => position === index ? value : phone));
    clearError(field);
  }
  function addPhone(field: PhoneField) {
    updatePhones(field, (current) => current.length < LEAD_CREATE_LIMITS.phones ? [...current, ""] : current);
  }
  function removePhone(field: PhoneField, index: number) {
    updatePhones(field, (current) => current.length > 1 ? current.filter((_, position) => position !== index) : [""]);
  }
  function handlePhoneBlur() {
    // Quick-add validates the phone collection together at submission.
  }
  function changeRating(value: number) { setRating(value); }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void handleQuickSave();
    if (event.key === "Escape") onCancel();
  }
  return {
    t,
    lang,
    stage,
    sources,
    profileType,
    firstName,
    lastName,
    individualPhones,
    companyMode,
    existingCompanyPartyId,
    selectedCompanyName,
    companyName,
    contactFirstName,
    contactLastName,
    companyPhones,
    contactPhones,
    sourceId,
    rating,
    errors,
    isSubmitting,
    companyLookup,
    companyComboboxOptions,
    selectedCompany,
    handleOpenFullModal,
    onCancel,
    handleQuickSave,
    changeText,
    changeProfileType,
    changeCompanyMode,
    changeExistingCompany,
    changePhone,
    addPhone,
    removePhone,
    handlePhoneBlur,
    changeRating,
    handleKeyDown,
  };
}
