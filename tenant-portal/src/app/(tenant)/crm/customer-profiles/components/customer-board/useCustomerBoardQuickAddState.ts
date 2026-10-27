"use client";

import { useMemo, useState } from "react";
import type { ComboboxOption } from "@/design-system";
import { useLeadCompanyOptions } from "../../../leads/hooks/useLeadCompanyOptions";
export function useCustomerBoardQuickAddState(branchId: string) {

  const [profileType, setProfileType] = useState<"INDIVIDUAL" | "CORPORATE">(
    "INDIVIDUAL",
  );
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
  const companyLookup = useLeadCompanyOptions(
    branchId,
    profileType === "CORPORATE",
  );
  const [companyQuery, setCompanyQuery] = useState("");
  const companyComboboxOptions = useMemo<ComboboxOption[]>(() => {
    const needle = companyQuery.trim().toLowerCase();
    return companyLookup.companies
      .filter((c) => {
        if (!needle) return true;
        return [c.displayName, c.legalName, c.organizationName]
          .filter((name): name is string => Boolean(name))
          .some((name) => name.toLowerCase().includes(needle));
      })
      .map((c) => ({
        value: c.id,
        label: c.displayName,
        description: c.legalName ?? c.organizationName ?? undefined,
      }));
  }, [companyLookup.companies, companyQuery]);
  const selectedCompany = useMemo(
    () =>
      companyLookup.companies.find((c) => c.id === existingCompanyPartyId) ??
      null,
    [companyLookup.companies, existingCompanyPartyId],
  );
  function clearError(prefix: string) {
    setErrors((prev) => {
      if (
        !Object.keys(prev).some(
          (k) => k === prefix || k.startsWith(`${prefix}.`),
        )
      ) {
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

  return {
    profileType, firstName, lastName, individualPhones, companyMode, existingCompanyPartyId,
    selectedCompanyName, companyName, contactFirstName, contactLastName, companyPhones,
    contactPhones, sourceId, rating, errors, isSubmitting,
    setProfileType, setFirstName, setLastName, setIndividualPhones, setCompanyMode,
    setExistingCompanyPartyId, setSelectedCompanyName, setCompanyName, setContactFirstName,
    setContactLastName, setCompanyPhones, setContactPhones, setSourceId, setRating, setErrors,
    setIsSubmitting, setCompanyQuery, companyLookup, companyComboboxOptions, selectedCompany, clearError,
  };
}
