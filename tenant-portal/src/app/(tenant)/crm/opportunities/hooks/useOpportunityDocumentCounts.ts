"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import {
  OPPORTUNITY_DOCUMENT_COUNT_KINDS,
  OPPORTUNITY_DOCUMENT_COUNT_PATHS,
  OPPORTUNITY_DOCUMENT_COUNT_PERMISSIONS,
  parseOpportunityDocumentCounts,
  type OpportunityDocumentCounts,
  type OpportunityDocumentCountKind,
  type OpportunityDocumentCountVisibility,
} from "../opportunity-document-counts-contract";

const EMPTY_COUNTS: OpportunityDocumentCounts = {
  quotations: null,
  salesOrders: null,
  invoices: null,
};

export function useOpportunityDocumentCounts(
  items: readonly { customerPartyId: string | null }[],
  branchId: string | null,
  enabled: boolean,
): {
  countsByParty: ReadonlyMap<string, OpportunityDocumentCounts>;
  visible: OpportunityDocumentCountVisibility;
  isLoading: boolean;
} {
  const { user } = useTenantAuth();
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const partyIds = useMemo(
    () =>
      [...new Set(items.map(({ customerPartyId }) => customerPartyId).filter(isUUIDv7))].slice(
        0,
        100,
      ),
    [items],
  );
  const partyKey = partyIds.join(",");
  const permissions = user?.permissions ?? [];
  const visible = Object.fromEntries(
    OPPORTUNITY_DOCUMENT_COUNT_KINDS.map((kind) => [
      kind,
      permissions.includes(OPPORTUNITY_DOCUMENT_COUNT_PERMISSIONS[kind]),
    ]),
  ) as OpportunityDocumentCountVisibility;
  const permissionKey = OPPORTUNITY_DOCUMENT_COUNT_KINDS.map((kind) =>
    visible[kind] ? "1" : "0",
  ).join("");
  const [countsByParty, setCountsByParty] = useState<
    ReadonlyMap<string, OpportunityDocumentCounts>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const scopeHeaders = scope.headers;

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !isUUIDv7(branchId) || partyIds.length === 0 || !scopeHeaders) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setCountsByParty(new Map());
          setIsLoading(false);
        }
      });
      return () => controller.abort();
    }
    const requestHeaders = scopeHeaders;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setCountsByParty(
        new Map(partyIds.map((partyId) => [partyId, { ...EMPTY_COUNTS }])),
      );
      setIsLoading(true);

      async function load(
        kind: OpportunityDocumentCountKind,
      ): Promise<Map<string, number> | null> {
        if (!visible[kind]) return null;
        try {
          const response = await axiosClient.post<unknown>(
            OPPORTUNITY_DOCUMENT_COUNT_PATHS[kind],
            { partyIds },
            {
              signal: controller.signal,
              cache: "no-store",
              headers: requestHeaders,
              maxResponseBytes: 64 * 1024,
              skipAutoIdempotency: true,
              replayAfterRefresh: true,
            },
          );
          return parseOpportunityDocumentCounts(response.data, partyIds);
        } catch {
          return null;
        }
      }

      void Promise.all(OPPORTUNITY_DOCUMENT_COUNT_KINDS.map(load)).then((results) => {
        if (controller.signal.aborted) return;
        setCountsByParty(
          new Map(
            partyIds.map((partyId) => [
              partyId,
              Object.fromEntries(
                OPPORTUNITY_DOCUMENT_COUNT_KINDS.map((kind, index) => [
                  kind,
                  results[index]?.get(partyId) ?? null,
                ]),
              ) as OpportunityDocumentCounts,
            ]),
          ),
        );
        setIsLoading(false);
      });
    });
    return () => controller.abort();
    // Stable scalar keys cover the derived array/object values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, branchId, partyKey, permissionKey, scopeHeaders]);

  return { countsByParty, visible, isLoading };
}
