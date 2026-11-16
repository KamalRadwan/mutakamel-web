"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { PARTY_DOCUMENT_COUNT_KINDS, PARTY_DOCUMENT_COUNT_PATHS, PARTY_DOCUMENT_COUNT_PERMISSIONS, PARTY_DOCUMENT_COUNT_SCOPED, parsePartyDocumentCountsResponse, partyDocumentCountsRequestBody, type PartyDocumentCountKind } from "../../../shared/party-document-counts-contract";

type CountState = { status: "loading" | "unavailable" | "denied"; count: null } | { status: "ready"; count: number };
export function useCustomerBusinessCounts(partyId: string | null, branchId: string) {
  const { user } = useTenantAuth();
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const permissions = user?.permissions ?? [];
  const permissionKey = PARTY_DOCUMENT_COUNT_KINDS.map((kind) => hasPermission(permissions, PARTY_DOCUMENT_COUNT_PERMISSIONS[kind], PARTY_DOCUMENT_COUNT_SCOPED[kind]) ? "1" : "0").join("");
  const [revision, setRevision] = useState(0);
  const key = `${user?.id ?? ""}:${partyId ?? ""}:${branchId}:${permissionKey}:${revision}`;
  const [settled, setSettled] = useState<{ key: string; counts: Partial<Record<PartyDocumentCountKind, CountState>> }>({ key: "", counts: {} });
  const counts = useMemo(() => settled.key === key ? settled.counts : {}, [settled, key]);
  const states = useMemo(() => Object.fromEntries(PARTY_DOCUMENT_COUNT_KINDS.map((kind, index) => [kind,
    permissionKey[index] !== "1" ? { status: "denied", count: null } : counts[kind] ?? { status: partyId && scope.headers ? "loading" : "unavailable", count: null },
  ])) as Record<PartyDocumentCountKind, CountState>, [permissionKey, counts, partyId, scope.headers]);
  useEffect(() => {
    const controller = new AbortController();
    if (!partyId || !scope.headers) return () => controller.abort();
    const headers = scope.headers;
    void Promise.all(PARTY_DOCUMENT_COUNT_KINDS.map(async (kind, index) => {
      if (permissionKey[index] !== "1") return;
      let state: CountState;
      try {
        const response = await axiosClient.post<unknown>(PARTY_DOCUMENT_COUNT_PATHS[kind], partyDocumentCountsRequestBody(kind, branchId, [partyId]), {
          signal: controller.signal, cache: "no-store", ...(kind === "opportunities" ? {} : { headers }),
          maxResponseBytes: 64 * 1024, skipAutoIdempotency: true, replayAfterRefresh: true,
        });
        const result = parsePartyDocumentCountsResponse(response.data, [partyId]);
        state = { status: "ready", count: result.get(partyId)! };
      } catch (caught) { state = { status: normalizeApiError(caught).status === 403 ? "denied" : "unavailable", count: null }; }
      if (!controller.signal.aborted) setSettled((current) => ({ key, counts: { ...(current.key === key ? current.counts : {}), [kind]: state } }));
    }));
    return () => controller.abort();
  }, [partyId, branchId, permissionKey, revision, scope.headers, key]);
  return { states, reload: () => setRevision((current) => current + 1) };
}
