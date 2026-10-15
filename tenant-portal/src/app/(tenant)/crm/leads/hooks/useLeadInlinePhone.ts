"use client";

import { useState } from "react";
import { leadEditablePrimaryPhone } from "../lead-phone-patch";
import type { LeadItem } from "./useLeads";

export interface LeadInlinePhone {
  editingLeadId: string | null;
  draft: string;
  setDraft: (next: string) => void;
  start: (lead: LeadItem) => void;
  cancel: () => void;
  commit: (lead: LeadItem) => void;
}

/**
 * One table-wide editor for the lead's primary phone. It starts from the
 * number the PATCH replaces (`leadEditablePrimaryPhone`), never from a guessed
 * country prefix, and closes on save because the page owns the write and its
 * failure feedback.
 */
export function useLeadInlinePhone(
  onSave: (lead: LeadItem, nextPhone: string) => void,
): LeadInlinePhone {
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return {
    editingLeadId,
    draft,
    setDraft,
    start: (lead) => {
      setEditingLeadId(lead.id);
      setDraft(leadEditablePrimaryPhone(lead));
    },
    cancel: () => setEditingLeadId(null),
    commit: (lead) => {
      onSave(lead, draft.trim());
      setEditingLeadId(null);
    },
  };
}
