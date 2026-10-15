"use client";

import { useEffect, useMemo, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import {
  BODY_READ_OPTIONS,
  LEADS_DOCUMENT_COUNTS_PATH,
  MAX_BULK_LEAD_IDS,
  parseLeadDocumentCountsResponse,
} from "../lead-bulk-contract";
import type {
  LeadDocumentCounts,
  LeadDocumentCountVisibility,
} from "../lead-document-counts-contract";
import type { LeadItem } from "./useLeads";

const NONE_VISIBLE: LeadDocumentCountVisibility = {
  opportunities: false,
  quotations: false,
  salesOrders: false,
  invoices: false,
};

/**
 * The four Lead card counters (OPP / PQ / SO / IN) for every card on the page,
 * from ONE `POST /api/tenant/crm/v1/leads/document-counts` per 100 Parties.
 * CRM answers each counter `null` when the user may not see it or the tenant
 * has no Trade; a kind is `visible` when the backend answered it for any card.
 */
export function useLeadDocumentCounts(
  leads: readonly LeadItem[],
  branchId: string | null,
  enabled: boolean,
): {
  countsByParty: ReadonlyMap<string, LeadDocumentCounts>;
  visible: LeadDocumentCountVisibility;
} {
  const partyIds = useMemo(
    () => [...new Set(leads.map(({ partyId }) => partyId).filter(isUUIDv7))],
    [leads],
  );
  const partyKey = partyIds.join(",");
  const [state, setState] = useState<{
    countsByParty: ReadonlyMap<string, LeadDocumentCounts>;
    visible: LeadDocumentCountVisibility;
  }>({ countsByParty: new Map(), visible: NONE_VISIBLE });

  useEffect(() => {
    const controller = new AbortController();
    const ids = partyKey ? partyKey.split(",") : [];
    if (!enabled || !isUUIDv7(branchId) || ids.length === 0) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setState({ countsByParty: new Map(), visible: NONE_VISIBLE });
      });
      return () => controller.abort();
    }
    const requestBranchId = branchId;
    void (async () => {
      try {
        const counts = new Map<string, LeadDocumentCounts>();
        for (let offset = 0; offset < ids.length; offset += MAX_BULK_LEAD_IDS) {
          const batch = ids.slice(offset, offset + MAX_BULK_LEAD_IDS);
          const response = await axiosClient.post<unknown>(
            LEADS_DOCUMENT_COUNTS_PATH,
            { branchId: requestBranchId, partyIds: batch },
            { ...BODY_READ_OPTIONS, signal: controller.signal },
          );
          for (const [partyId, row] of parseLeadDocumentCountsResponse(response.data, batch)) {
            counts.set(partyId, row);
          }
        }
        if (controller.signal.aborted) return;
        const rows = [...counts.values()];
        setState({
          countsByParty: counts,
          visible: {
            opportunities: rows.some((row) => row.opportunities !== null),
            quotations: rows.some((row) => row.quotations !== null),
            salesOrders: rows.some((row) => row.salesOrders !== null),
            invoices: rows.some((row) => row.invoices !== null),
          },
        });
      } catch {
        // Advisory counters: a failed read leaves the cards showing "—".
        if (!controller.signal.aborted) setState({ countsByParty: new Map(), visible: NONE_VISIBLE });
      }
    })();
    return () => controller.abort();
  }, [branchId, enabled, partyKey]);

  return state;
}
