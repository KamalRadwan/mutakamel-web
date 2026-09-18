"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import {
  PARTY_DOCUMENT_COUNT_KINDS,
  PARTY_DOCUMENT_COUNT_PATHS,
  PARTY_DOCUMENT_COUNT_PERMISSIONS,
  parsePartyDocumentCountsResponse,
  type PartyDocumentCountKind,
  type PartyDocumentCounts,
  type PartyDocumentCountVisibility,
} from "../party-document-counts-contract";

const EMPTY_COUNTS: PartyDocumentCounts = {
  quotations: null,
  salesOrders: null,
  invoices: null,
};

export function usePartyDocumentCounts(
  parties: readonly { partyId: string }[],
  branchId: string | null,
  enabled: boolean,
): {
  countsByParty: ReadonlyMap<string, PartyDocumentCounts>;
  visible: PartyDocumentCountVisibility;
} {
  const { user } = useTenantAuth();
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const partyIds = useMemo(
    () => [
      ...new Set(parties.map(({ partyId }) => partyId).filter(isUUIDv7)),
    ].slice(0, 100),
    [parties],
  );
  const partyKey = partyIds.join(",");
  const permissions = user?.permissions ?? [];
  const visible = Object.fromEntries(
    PARTY_DOCUMENT_COUNT_KINDS.map((kind) => [
      kind,
      permissions.includes(PARTY_DOCUMENT_COUNT_PERMISSIONS[kind]),
    ]),
  ) as PartyDocumentCountVisibility;
  const permissionKey = PARTY_DOCUMENT_COUNT_KINDS.map((kind) =>
    visible[kind] ? "1" : "0",
  ).join("");
  const [countsByParty, setCountsByParty] = useState<
    ReadonlyMap<string, PartyDocumentCounts>
  >(new Map());
  const scopeHeaders = scope.headers;

  useEffect(() => {
    const controller = new AbortController();
    if (
      !enabled ||
      !isUUIDv7(branchId) ||
      partyIds.length === 0 ||
      !scopeHeaders
    ) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setCountsByParty(new Map());
      });
      return () => controller.abort();
    }
    const requestHeaders = scopeHeaders;

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setCountsByParty(
        new Map(
          partyIds.map((partyId) => [partyId, { ...EMPTY_COUNTS }]),
        ),
      );

      async function load(
        kind: PartyDocumentCountKind,
      ): Promise<Map<string, number> | null> {
        if (!visible[kind]) return null;
        try {
          const response = await axiosClient.post<unknown>(
            PARTY_DOCUMENT_COUNT_PATHS[kind],
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
          return parsePartyDocumentCountsResponse(response.data, partyIds);
        } catch {
          return null;
        }
      }

      void Promise.all(PARTY_DOCUMENT_COUNT_KINDS.map(load)).then(
        (results) => {
          if (controller.signal.aborted) return;
          setCountsByParty(
            new Map(
              partyIds.map((partyId) => [
                partyId,
                Object.fromEntries(
                  PARTY_DOCUMENT_COUNT_KINDS.map((kind, index) => [
                    kind,
                    results[index]?.get(partyId) ?? null,
                  ]),
                ) as PartyDocumentCounts,
              ]),
            ),
          );
        },
      );
    });
    return () => controller.abort();
    // `visible` and `partyIds` are derived objects; their stable keys capture
    // exactly the values that make a different request necessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, branchId, partyKey, permissionKey, scopeHeaders]);

  return { countsByParty, visible };
}
