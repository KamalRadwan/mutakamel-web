"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormModalSection } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { resolveCompanyForBranch } from "@/lib/api/organization-scope";
import { getHonorificOptions } from "@/lib/catalogues/contact-titles";
import { isUUIDv7 } from "@/lib/uuid";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import type { CrmTag } from "../../shared/tag-contract";
import {
  isCorporateLead,
  usesExistingCompany,
  LEAD_CREATE_LIMITS,
  type CreateLeadForm,
  type QuickCreateLeadDraft,
} from "../lead-create-contract";
import { leadCreateSectionErrorCount, type LeadCreateSectionId } from "../lead-create-validation";
import { useCreateLeadForm } from "./useCreateLeadForm";
import { useCreateLeadTags } from "./useCreateLeadTags";
import { useLeadCompanyOptions } from "./useLeadCompanyOptions";
import { useLeadDuplicateCheck } from "./useLeadDuplicateCheck";

interface CreateLeadModalOptions {
  branchId: string | null;
  initialStageId?: string;
  initialDraft?: QuickCreateLeadDraft | null;
  onSubmit: (form: CreateLeadForm) => Promise<boolean>;
}

/**
 * Everything the create-lead modal holds. The modal is mounted only while it
 * is open, so every catalogue read here belongs to an actual create.
 */
export function useCreateLeadModal({ branchId, initialStageId, initialDraft, onSubmit }: CreateLeadModalOptions) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const companyOptions = useLeadCompanyOptions(branchId, true);
  const acquisitionSources = useCrmAcquisitionSources();
  const customFields = useCrmCreateCustomFields("LEAD", true);
  const leadTags = useCreateLeadTags(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickedCompanyId, setPickedCompanyId] = useState<string | null>(null);
  const [createTag, setCreateTag] = useState<{ open: boolean; initialName: string }>({ open: false, initialName: "" });

  const fieldMessages = useCrmFieldMessages();
  const messages = useMemo(
    () => ({
      ...fieldMessages,
      contactRequired: t.crmLeads.create.errors.contactRequired,
      tagsLimit: t.crmLeads.create.errors.tagsLimit,
      tagsInvalid: t.crmLeads.create.errors.tagsInvalid,
    }),
    [fieldMessages, t],
  );
  const state = useCreateLeadForm(
    messages,
    customFields.requiredFieldKeys,
    initialStageId,
    getHonorificOptions(lang)[0]?.label ?? "",
    initialDraft,
  );
  const { form, errors, allErrors } = state;

  // A quick-add draft that reused a Directory company needs its contacts listed.
  const { selectCompany: loadCompanyContacts } = companyOptions;
  const draftCompanyId = initialDraft?.existingCompanyPartyId;
  useEffect(() => {
    if (draftCompanyId) void loadCompanyContacts(draftCompanyId);
  }, [draftCompanyId, loadCompanyContacts]);

  const corporate = isCorporateLead(form);
  const existingCompany = usesExistingCompany(form);

  // A Directory company whose name contains the new company's typed name.
  const companyMatch = useMemo(() => {
    if (!corporate || existingCompany) return null;
    const query = form.companyName.trim().toLowerCase();
    if (query.length < 3) return null;
    return companyOptions.companies.find((item) => item.displayName.toLowerCase().includes(query)) ?? null;
  }, [companyOptions.companies, corporate, existingCompany, form.companyName]);

  // Exact Directory duplicates from the server; the company already offered
  // by the name match above is not repeated.
  const serverDuplicates = useLeadDuplicateCheck(form, branchId, true).filter(
    (match) => match.partyId !== companyMatch?.id,
  );

  // Every branch this account may file into, paired with the company that owns
  // it. `/auth/me` is the only proven source for either — `accessibleBranches`
  // and the `accessibleBranchCompanies` ownership map on `TenantUserProfile`.
  // `resolveCompanyForBranch` is the SAME authority the Gateway scope headers
  // are built from: two readings of one map is how the picker and the request
  // end up disagreeing about who owns a branch.
  const branchOwners = useMemo(() => {
    const ids = [...new Set((user?.accessibleBranches ?? []).filter(isUUIDv7))];
    return ids.map((id) => ({ branchId: id, companyId: resolveCompanyForBranch(user, id) }));
  }, [user]);

  // Companies drop out when ownership cannot be established — an older Core
  // response with no map at all, or team memberships that pair one branch with
  // two companies. Guessing there would pair a lead with the wrong company.
  const companyIds = useMemo(
    () => [
      ...new Set(
        branchOwners
          .map(({ companyId }) => companyId)
          .filter((companyId): companyId is string => companyId !== null),
      ),
    ],
    [branchOwners],
  );

  // Empty `form.branchId` means the branch the list screen is on — see
  // `buildCreateLeadRequest`.
  const activeBranchId = form.branchId || branchId || "";
  const companyId =
    pickedCompanyId && companyIds.includes(pickedCompanyId)
      ? pickedCompanyId
      : (branchOwners.find((pair) => pair.branchId === activeBranchId)?.companyId ?? null);

  // With no resolvable company the list is every accessible branch rather than
  // none: the company is a filter over branches, and a filter that cannot be
  // evaluated must not hide the thing it filters.
  const branchIds = useMemo(
    () =>
      branchOwners
        .filter((pair) => companyId === null || pair.companyId === companyId)
        .map((pair) => pair.branchId),
    [branchOwners, companyId],
  );

  // Storing the screen's own branch would mark the form dirty for a pick that
  // changed nothing. A different branch is stored explicitly so
  // `buildCreateLeadRequest` files the lead there and the response parser
  // validates against that same branch.
  function chooseBranch(next: string) {
    state.setField("branchId", next === branchId ? "" : next);
  }

  // The company is not sent anywhere; it only narrows the branch list. Moving
  // to a company that does not own the active branch moves the branch too.
  function chooseCompany(next: string) {
    setPickedCompanyId(next);
    const owned = branchOwners.filter((pair) => pair.companyId === next);
    if (!owned.some((pair) => pair.branchId === activeBranchId)) {
      chooseBranch(owned[0]?.branchId ?? "");
    }
  }

  function adoptMatchedCompany() {
    if (!companyMatch) return;
    state.selectCompany(companyMatch.id, companyMatch.displayName);
    void companyOptions.selectCompany(companyMatch.id);
  }

  function handleTagCreated(tag: CrmTag) {
    leadTags.addTag(tag);
    if (form.tagIds.length < LEAD_CREATE_LIMITS.tags && !form.tagIds.includes(tag.id)) {
      state.setField("tagIds", [...form.tagIds, tag.id]);
    }
  }

  const sections = useMemo<FormModalSection[]>(() => {
    const invalid = (ids: LeadCreateSectionId[]) =>
      ids.some((id) => leadCreateSectionErrorCount(errors, id) > 0);
    const steps = t.crmLeads.create.steps;
    const essential: LeadCreateSectionId[] = corporate
      ? ["classification", "company", "contacts"]
      : ["classification", "person"];
    const entries: FormModalSection[] = [
      { id: "essential", targetSectionIds: essential, label: steps.essential.title, invalid: invalid(essential) },
    ];
    if (!existingCompany) {
      entries.push({ id: "address", targetSectionIds: ["address"], label: steps.address.title, invalid: invalid(["address"]) });
    }
    entries.push({
      id: "qualification",
      targetSectionIds: ["qualification"],
      label: steps.qualification.title,
      invalid: invalid(["qualification"]),
    });
    if (customFields.definitions.length > 0) {
      entries.push({
        id: "customFields",
        targetSectionIds: ["customFields"],
        label: steps.customFields.title,
        invalid: invalid(["customFields"]),
      });
    }
    return entries;
  }, [corporate, existingCompany, customFields.definitions.length, errors, t]);

  async function submit() {
    // Every field speaks now, including the ones never focused. Submit is NOT
    // disabled while the form is invalid: a disabled button gives a keyboard
    // user no way to ask what is wrong, so the press is what reveals it.
    state.revealAll();
    if (Object.keys(allErrors).length > 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    state,
    corporate,
    existingCompany,
    isSubmitting,
    errorCount: Object.keys(errors).length,
    sections,
    companyOptions,
    sources: acquisitionSources,
    customFields,
    leadTags,
    companyMatch,
    adoptMatchedCompany,
    serverDuplicates,
    companyIds,
    companyId,
    branchIds,
    activeBranchId,
    chooseBranch,
    chooseCompany,
    createTag,
    openCreateTag: (initialName: string) => setCreateTag({ open: true, initialName }),
    closeCreateTag: () => setCreateTag((current) => ({ ...current, open: false })),
    handleTagCreated,
    submit,
  };
}
