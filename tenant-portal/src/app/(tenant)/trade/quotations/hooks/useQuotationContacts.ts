"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { TRADE_LIST_RESPONSE_BYTES, tradeInvalidResponse } from "../../documents/trade-document-contract";
import { hasQuotationScope } from "../quotation-composer-draft";
import { parseQuotationContactPage, quotationContactOptionsPath, QUOTATION_CONTACT_SEARCH_MAX,
  type QuotationContactOption, type QuotationPartyType } from "../quotation-contact-contract";

interface ContactState {
  identity: string; search: string; items: QuotationContactOption[]; partyType: QuotationPartyType;
  nextCursor: string | null; seen: string[]; error: NormalizedApiError | null; loading: boolean;
}

/** Cursor results are quarantined during render for actor, scope, party and search changes. */
export function useQuotationContacts({ headers, partyId, partyType = null, enabled }: {
  headers: Record<string, string>; partyId: string | null; partyType?: QuotationPartyType | null; enabled: boolean;
}) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const identity = JSON.stringify([user?.id, realtimeAuthGeneration, Object.entries(headers).sort(), partyId, partyType]);
  const [query, setQuery] = useState({ identity, search: "", cursor: null as string | null });
  const search = query.identity === identity ? query.search : "";
  const cursor = query.identity === identity ? query.cursor : null;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ContactState | null>(null);
  const canLoad = enabled && Boolean(user?.id && partyId) && partyType !== "PERSON" && hasQuotationScope(headers);
  const headersKey = JSON.stringify(Object.entries(headers).sort());

  useEffect(() => {
    if (!canLoad || !partyId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setState((previous) => ({ identity, search, items: previous?.identity === identity && previous.search === search ? previous.items : [],
        partyType: partyType ?? "ORGANIZATION", nextCursor: null, seen: previous?.identity === identity && previous.search === search ? previous.seen : [],
        error: null, loading: true }));
      void tradeGet(quotationContactOptionsPath(partyId, search, cursor), { headers: JSON.parse(headersKey),
        signal: controller.signal, maxResponseBytes: TRADE_LIST_RESPONSE_BYTES }).then((response) => {
        if (controller.signal.aborted) return;
        const page = parseQuotationContactPage(response.data);
        if (partyType && page.partyType !== partyType) tradeInvalidResponse();
        setState((previous) => {
          const prior = cursor && previous?.identity === identity && previous.search === search ? previous : null;
          const seen = [...(prior?.seen ?? []), ...(cursor ? [cursor] : [])];
          const items = [...new Map([...(prior?.items ?? []), ...page.items].map((item) => [item.partyId, item])).values()];
          return { identity, search, items, partyType: page.partyType, seen, loading: false, error: null,
            nextCursor: page.nextCursor && !seen.includes(page.nextCursor) ? page.nextCursor : null };
        });
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ identity, search,
          items: previous?.identity === identity && previous.search === search ? previous.items : [],
          partyType: partyType ?? "ORGANIZATION", nextCursor: cursor,
          seen: previous?.identity === identity && previous.search === search ? previous.seen : [],
          loading: false, error: normalizeApiError(error) }));
      });
    });
    return () => controller.abort();
  }, [canLoad, cursor, headersKey, identity, partyId, partyType, revision, search]);

  const current = state?.identity === identity && state.search === search ? state : null;
  const isLoading = canLoad && (!current || current.loading);
  return {
    enabled: canLoad,
    options: canLoad && !current?.error ? current?.items ?? [] : [], search, isLoading,
    partyType: canLoad ? current?.partyType ?? partyType : partyType,
    error: canLoad ? current?.error ?? null : null,
    hasMore: canLoad && !current?.error && Boolean(current?.nextCursor),
    setSearch: (value: string) => {
      const next = [...value].slice(0, QUOTATION_CONTACT_SEARCH_MAX).join("");
      setQuery((previous) => previous.identity === identity && previous.search === next && previous.cursor === null
        ? previous : { identity, search: next, cursor: null });
    },
    loadMore: () => { if (!isLoading && current?.nextCursor) setQuery({ identity, search, cursor: current.nextCursor }); },
    retry: () => setRevision((previous) => previous + 1),
  };
}

export type QuotationContactsState = ReturnType<typeof useQuotationContacts>;
