"use client";

import { useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useCreateLeadTags } from "../../leads/hooks/useCreateLeadTags";
import { opportunityCapabilityAllowsOwner } from "./usePipelineWorkspace";
import { useCustomerProfileOptions } from "./useCustomerProfileOptions";
import { useOpportunityCurrencyOptions } from "./useCreateOpportunity";
import { useOpportunityFormLookups } from "./useOpportunityFormLookups";
import type { CreateOpportunityModalProps } from "../components/CreateOpportunityModal";
import { opportunityCreateNeedsFullView } from "./opportunity-create-visibility";

export function useOpportunityCreatePresentation({ create, branchId, createCapability, updateCapability, customFields }: CreateOpportunityModalProps) {
  const { user } = useTenantAuth();
  const customers = useCustomerProfileOptions(branchId, create.open);
  const lookups = useOpportunityFormLookups({ branchId, customerProfileId: create.form.customerProfileId, enabled: create.open, action: "create" });
  const tags = useCreateLeadTags(create.open);
  const currencyOptions = useOpportunityCurrencyOptions(create.open);
  const [tagDraftName, setTagDraftName] = useState<string | null>(null);
  const ownerId = create.form.ownerUserId || user?.id || null;
  const canAttachTags = opportunityCapabilityAllowsOwner(updateCapability, ownerId);
  const allowedOwners = lookups.owners.items.filter((owner) => opportunityCapabilityAllowsOwner(createCapability, owner.id));
  const canDefaultToSelf = Boolean(user && opportunityCapabilityAllowsOwner(createCapability, user.id));
  const blocked = Boolean(create.ambiguity || create.tagRecovery || create.appliedUnreadable);
  const navigationGuard = useUnsavedChangesGuard(create.open && create.view === "full" && (create.isDirty || create.isSubmitting || create.isRetryingTags || blocked));
  return {
    customers: { ...customers, items: customers.items.filter((customer) => opportunityCapabilityAllowsOwner(createCapability, customer.ownerUserId)) },
    lookups: { ...lookups, owners: { ...lookups.owners, items: allowedOwners } },
    defaultOwnerId: canDefaultToSelf ? user?.id : undefined,
    canAttachTags, tags, currencyOptions, tagDraftName, setTagDraftName,
    onTagCreated: (created: Parameters<typeof tags.addTag>[0]) => {
      tags.addTag(created); create.toggleTag(created.id); setTagDraftName(null);
    },
    blocked, navigationGuard,
    requestClose: () => {
      if (create.view === "full") navigationGuard.requestDiscard(create.closeModal);
      else create.closeModal();
    },
    submit: (keepOpenAfterSuccess: boolean) => {
      if (create.view === "fast" && opportunityCreateNeedsFullView(create.allErrors ?? {}, customFields.requiredFieldKeys ?? [])) create.setView("full");
      return create.submit({ keepOpenAfterSuccess });
    },
  };
}
