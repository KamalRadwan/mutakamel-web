"use client";

import { useMemo, useState } from "react";
import type { ComboboxOption } from "@/design-system";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import {
  EMPTY_BOARD_QUICK_ADD,
  buildBoardQuickAddDraft,
  buildBoardQuickAddRequest,
  defaultQuickAddSourceId,
  validateBoardQuickAdd,
  type BoardQuickAddPhoneList,
  type BoardQuickAddTextField,
  type BoardQuickAddValues,
} from "../components/board/board-quick-add";
import { LEAD_CREATE_LIMITS, type CreateLeadRequest, type CrmProfileType, type QuickCreateLeadDraft } from "../lead-create-contract";
import { useLeadCompanyOptions } from "./useLeadCompanyOptions";

export interface BoardQuickAddOptions {
  stageId: string;
  branchId: string;
  onSubmit: (payload: CreateLeadRequest, rating: number) => Promise<boolean>;
  onOpenFullModal: (draft: QuickCreateLeadDraft) => void;
}

function withoutErrors(errors: Record<string, string>, prefix: string): Record<string, string> {
  const kept = Object.entries(errors).filter(
    ([key]) => key !== prefix && !key.startsWith(`${prefix}.`),
  );
  return kept.length === Object.keys(errors).length ? errors : Object.fromEntries(kept);
}

/** The in-column quick-create card: its values, validation and the two ways out. */
export function useBoardQuickAdd({ stageId, branchId, onSubmit, onOpenFullModal }: BoardQuickAddOptions) {
  const fieldMessages = useCrmFieldMessages();
  const { items: sources } = useCrmAcquisitionSources();
  const [values, setValues] = useState<BoardQuickAddValues>(EMPTY_BOARD_QUICK_ADD);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");

  // The directory is read only once the user is actually choosing a company.
  const companyLookup = useLeadCompanyOptions(branchId, values.leadProfileType === "CORPORATE");

  const sourceId = values.acquisitionSourceId || defaultQuickAddSourceId(sources);
  const existingCompanyName =
    companyLookup.companies.find(({ id }) => id === values.existingCompanyPartyId)?.displayName ?? "";

  const companyOptions = useMemo<ComboboxOption[]>(() => {
    const needle = companyQuery.trim().toLowerCase();
    return companyLookup.companies
      .filter((company) =>
        [company.displayName, company.legalName, company.organizationName].some(
          (name) => !needle || Boolean(name?.toLowerCase().includes(needle)),
        ),
      )
      .map((company) => ({
        value: company.id,
        label: company.displayName,
        description: company.legalName ?? company.organizationName ?? undefined,
      }));
  }, [companyLookup.companies, companyQuery]);

  function update(patch: Partial<BoardQuickAddValues>, errorKey?: string) {
    setValues((current) => ({ ...current, ...patch }));
    if (errorKey) setErrors((current) => withoutErrors(current, errorKey));
  }

  function setPhones(list: BoardQuickAddPhoneList, next: (phones: string[]) => string[]) {
    setValues((current) => ({ ...current, [list]: next(current[list]) }));
    setErrors((current) => withoutErrors(current, list));
  }

  async function submit() {
    if (isSubmitting) return;
    const nextErrors = validateBoardQuickAdd(values, sourceId, fieldMessages);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit(buildBoardQuickAddRequest(values, { branchId, stageId, sourceId }), values.rating);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    values,
    errors,
    isSubmitting,
    sources,
    sourceId,
    companyOptions,
    existingCompanyName,
    isLoadingCompanies: companyLookup.isLoadingCompanies,
    setCompanyQuery,
    setText: (field: BoardQuickAddTextField, value: string) => update({ [field]: value }, field),
    setSource: (id: string) => update({ acquisitionSourceId: id }, "acquisitionSourceId"),
    setRating: (rating: number) => update({ rating }),
    setProfileType: (leadProfileType: CrmProfileType) => {
      update({ leadProfileType });
      setErrors({});
    },
    selectCompany: (id: string) => {
      update({ existingCompanyPartyId: id }, "companyName");
      setCompanyQuery("");
    },
    changePhone: (list: BoardQuickAddPhoneList, index: number, value: string) =>
      setPhones(list, (phones) => phones.map((phone, at) => (at === index ? value : phone))),
    addPhone: (list: BoardQuickAddPhoneList) =>
      setPhones(list, (phones) =>
        phones.length < LEAD_CREATE_LIMITS.phones ? [...phones, ""] : phones,
      ),
    removePhone: (list: BoardQuickAddPhoneList, index: number) =>
      setPhones(list, (phones) =>
        phones.length > 1 ? phones.filter((_, at) => at !== index) : [""],
      ),
    submit,
    openFullModal: () =>
      onOpenFullModal(buildBoardQuickAddDraft(values, { stageId, sourceId, existingCompanyName })),
  };
}

export type BoardQuickAdd = ReturnType<typeof useBoardQuickAdd>;
