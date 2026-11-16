"use client";

import { useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useCrmRecordOptions } from "@/hooks/useCrmRecordOptions";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { OutboundEmailRecipientReference, OutboundEmailSourceType } from "../outbound-email-contract";
import type { useOutboundEmailComposer } from "./useOutboundEmailComposer";

export function recipientKey(reference: OutboundEmailRecipientReference): string {
  return reference.kind === "PARTY_CONTACT" ? `PARTY_CONTACT:${reference.partyId}:${reference.contactId}` : "SOURCE_PRIMARY_CONTACT";
}

export function useComposeEmailForm(open: boolean, composer: ReturnType<typeof useOutboundEmailComposer>, onSelectionChange: () => void) {
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const [sourceType, setSourceType] = useState<OutboundEmailSourceType>("LEAD");
  const [sourceId, setSourceId] = useState<string>();
  const [sourceBranch, setSourceBranch] = useState(branchId);
  const [sourceLabel, setSourceLabel] = useState<string>();
  const [recipientId, setRecipientId] = useState("");
  const [templateVersionId, setTemplateVersionId] = useState("");
  const frozen = composer.isSending || composer.uncertain;
  const records = useCrmRecordOptions(open && composer.canSend ? sourceType : null, branchId);
  const visibleSourceId = sourceBranch === branchId || frozen ? sourceId : undefined;
  const options = composer.options?.sourceType === sourceType && composer.options.sourceId === visibleSourceId ? composer.options : null;
  const recipient = options?.recipients.find((candidate) => recipientKey(candidate.reference) === recipientId);
  const chosenTemplateVersionId = templateVersionId || options?.assignedTemplateVersionId || "";
  const canSend = Boolean(composer.canSend && !frozen && !composer.isLoadingOptions && sourceId && recipient &&
    !options?.availability.length && chosenTemplateVersionId && options?.templates.some((template) => template.templateVersionId === chosenTemplateVersionId));
  const navigation = useUnsavedChangesGuard(open && Boolean(sourceId));

  function clearSource() {
    setSourceId(undefined); setSourceLabel(undefined); setRecipientId(""); setTemplateVersionId(""); composer.reset();
  }
  return {
    branchIds, branchId: frozen ? sourceBranch : branchId, sourceType,
    sourceId: visibleSourceId, sourceLabel: visibleSourceId ? sourceLabel : undefined, recipientId,
    chosenTemplateVersionId, recipient, options, records, frozen, canSend, navigation,
    isDirty: Boolean(sourceId),
    changeBranch: (next: string | null) => { if (frozen) return; onSelectionChange(); selectBranch(next); clearSource(); },
    changeType: (next: string) => { if (frozen) return; onSelectionChange(); setSourceType(next as OutboundEmailSourceType); clearSource(); },
    changeSource: (next: string | undefined) => {
      if (frozen) return;
      onSelectionChange();
      setSourceId(next); setSourceBranch(branchId); setSourceLabel(records.options.find((record) => record.value === next)?.label);
      setRecipientId(""); setTemplateVersionId("");
      if (next) void composer.loadOptions(sourceType, next); else composer.reset();
    },
    changeRecipient: (next: string) => { if (!frozen) { onSelectionChange(); setRecipientId(next); composer.clearPreview(); } },
    changeTemplate: (next: string) => { if (!frozen) { onSelectionChange(); setTemplateVersionId(next); composer.clearPreview(); } },
    reloadOptions: () => { if (visibleSourceId && !frozen) void composer.loadOptions(sourceType, visibleSourceId); },
    preview: () => { if (canSend && sourceId && recipient) void composer.loadPreview(sourceType, sourceId, recipient.reference, chosenTemplateVersionId || null); },
  };
}
