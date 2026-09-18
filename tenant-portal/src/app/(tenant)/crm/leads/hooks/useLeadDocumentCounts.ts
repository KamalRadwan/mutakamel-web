"use client";

import { usePartyDocumentCounts } from "../../shared/hooks/usePartyDocumentCounts";
import type { LeadItem } from "./useLeads";

export function useLeadDocumentCounts(
  leads: readonly LeadItem[],
  branchId: string | null,
  enabled: boolean,
) {
  return usePartyDocumentCounts(leads, branchId, enabled);
}
