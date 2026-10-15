"use client";

import { useCallback, useState } from "react";
import type { CreateLeadForm, CreateLeadRequest, QuickCreateLeadDraft } from "../lead-create-contract";
import { createLeadFormFromQuickRequest } from "../lead-quick-create-draft";

interface LeadsWorkspaceCreateOptions {
  openCreate: () => void;
  setIsCreateOpen: (open: boolean) => void;
  handleCreate: (form: CreateLeadForm, initialRating?: number) => Promise<boolean>;
}

/**
 * The two ways a lead is created from the list screen: the full create modal
 * (from the header, or a board column with an optional quick-add draft) and
 * the board column's quick-add card saving directly.
 */
export function useLeadsWorkspaceCreate({ openCreate, setIsCreateOpen, handleCreate }: LeadsWorkspaceCreateOptions) {
  // A column's add action seeds the editable stage (and any draft typed in the
  // quick-add card); the header leaves both unset.
  const [stageId, setStageId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuickCreateLeadDraft | null>(null);

  const openInStage = useCallback(
    (nextStageId: string | null, nextDraft?: QuickCreateLeadDraft) => {
      setStageId(nextStageId);
      setDraft(nextDraft ?? null);
      openCreate();
    },
    [openCreate],
  );

  const close = useCallback(() => {
    setIsCreateOpen(false);
    setDraft(null);
  }, [setIsCreateOpen]);

  const quickCreate = useCallback(
    (request: CreateLeadRequest, rating?: number) =>
      handleCreate(createLeadFormFromQuickRequest(request, "quick-add-contact"), rating),
    [handleCreate],
  );

  return { stageId, draft, openInStage, close, quickCreate };
}
