"use client";

import { useMemo, useState } from "react";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useTenantBranchLabels } from "@/hooks/useTenantBranchLabels";
import { useOpportunityCapabilities } from "../../hooks/useOpportunityCapabilities";
import { useOpportunityCurrencyOptions } from "../../hooks/useCreateOpportunity";
import { useOpportunityFormLookups } from "../../hooks/useOpportunityFormLookups";
import { opportunityCapabilityAllowsOwner } from "../../hooks/usePipelineWorkspace";
import { useOpportunityDetail } from "./useOpportunityDetail";
import { useOpportunityEdit } from "./useOpportunityEdit";
import { useOpportunityStageMove } from "./useOpportunityStageMove";
import { usePipelineTransfer } from "./usePipelineTransfer";
import { useOpportunityRecordCommands } from "./useOpportunityRecordCommands";
import type { OpportunityFormContact, OpportunityFormOwner } from "../../components/opportunity-form/opportunity-form-types";

export function useOpportunitySavedWorkspace(opportunityId: string) {
  const detail = useOpportunityDetail(opportunityId);
  const item = detail.item;
  const { canMutate } = useAccessMode();
  const { capabilities, error: capabilitiesError } = useOpportunityCapabilities(item?.branchId ?? null);
  const canUpdate = canMutate && item !== null && opportunityCapabilityAllowsOwner(capabilities.update, item.ownerUserId);
  const canDelete = canMutate && item !== null && opportunityCapabilityAllowsOwner(capabilities.delete, item.ownerUserId);
  const edit = useOpportunityEdit(item, detail.reload, { continuous: true });
  const commands = useOpportunityRecordCommands(item, detail.reload, canUpdate, canDelete);
  const pipeline = detail.pipelines.find(({ id }) => id === item?.pipelineId) ?? null;
  const stageMove = useOpportunityStageMove(item, pipeline?.stages ?? [], canUpdate, detail.reload);
  const transfer = usePipelineTransfer(item, detail.pipelines, detail.reload);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const pendingStage = pipeline?.stages.find(({ id }) => id === pendingStageId) ?? null;
  const currentStage = pipeline?.stages.find(({ id }) => id === item?.stageId) ?? null;
  const locked = edit.locked || commands.saving || commands.feedback !== null || stageMove.isMoving || stageMove.uncertain || transfer.locked;
  const guard = useUnsavedChangesGuard(edit.isDirty || locked);
  const lookups = useOpportunityFormLookups({ branchId: item?.branchId ?? null, customerProfileId: item?.customerProfileId ?? "", leadId: item?.leadId, customerPartyId: item?.customerPartyId, enabled: Boolean(item), action: "update" });
  const formLookups = useMemo(() => {
    const owners: OpportunityFormOwner[] = [...lookups.owners.items];
    if (item?.ownerUserId && item.ownerDisplayName && !owners.some(({ id }) => id === item.ownerUserId)) {
      owners.push({ id: item.ownerUserId, displayName: item.ownerDisplayName, avatarUrl: item.ownerAvatarUrl, disabled: true });
    }
    const contacts: OpportunityFormContact[] = [...lookups.customer.contacts];
    if (item?.primaryContact && item.primaryContact.partyId === edit.form?.contactPartyId && !contacts.some(({ partyId }) => partyId === item.primaryContact?.partyId)) {
      contacts.push({ ...item.primaryContact, disabled: true });
    }
    return { owners: { ...lookups.owners, items: owners }, customer: { ...lookups.customer, contacts } };
  }, [lookups.owners, lookups.customer, item, edit.form?.contactPartyId]);
  const currencyOptions = useOpportunityCurrencyOptions(Boolean(item));
  const branches = useTenantBranchLabels(Boolean(item));
  const requestCommand = (action: () => void) => {
    if (locked) return;
    guard.requestDiscard(() => { edit.revert(); action(); });
  };
  return {
    detail, item, edit, commands, capabilitiesError, canUpdate, canDelete, canMutate, pipeline, currentStage,
    stageMove, transfer, pendingStage, setPendingStageId, locked, guard, lookups, formLookups, currencyOptions,
    branchLabel: item ? branches.get(item.branchId) ?? null : null,
    requestCommand,
    requestStage: (stageId: string) => { if (stageId !== item?.stageId && canUpdate) requestCommand(() => setPendingStageId(stageId)); },
  };
}
