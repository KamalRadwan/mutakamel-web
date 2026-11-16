"use client";

import { useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import type { QuotationContactOption } from "../quotation-contact-contract";
import { useQuotationContacts } from "./useQuotationContacts";

export const QUOTATION_CONTACT_DISPLAY_PAGE_LIMIT = 20;

/** Resolve an existing association through bounded authorized cursor pages. */
export function useQuotationContactDisplay(partyId: string, contactPartyId: string | null, headers: Record<string, string>) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const identity = JSON.stringify([user?.id, realtimeAuthGeneration, partyId, contactPartyId, Object.entries(headers).sort()]);
  const { enabled, options, isLoading: directoryLoading, error, hasMore, loadMore } = useQuotationContacts({ headers, partyId, partyType: null, enabled: !!contactPartyId });
  const contact = options.find((option) => option.partyId === contactPartyId) ?? null;
  const pages = useRef<{ identity: string; count: number; lastOptions: QuotationContactOption[] | null }>({ identity: "", count: 1, lastOptions: null });
  const [exhaustedIdentity, setExhaustedIdentity] = useState<string | null>(null);

  useEffect(() => {
    if (pages.current.identity !== identity) {
      pages.current = { identity, count: 1, lastOptions: null };
      queueMicrotask(() => { if (pages.current.identity === identity) setExhaustedIdentity(null); });
    }
    if (!contactPartyId || contact || !enabled || directoryLoading || error || !hasMore) return;
    if (pages.current.lastOptions === options) return;
    if (pages.current.count >= QUOTATION_CONTACT_DISPLAY_PAGE_LIMIT) {
      let cancelled = false;
      queueMicrotask(() => { if (!cancelled && pages.current.identity === identity) setExhaustedIdentity(identity); });
      return () => { cancelled = true; };
    }
    pages.current.lastOptions = options;
    pages.current.count += 1;
    loadMore();
  }, [contact, contactPartyId, enabled, error, hasMore, directoryLoading, loadMore, options, identity]);

  return { contact, isLoading: !!contactPartyId && enabled && !contact && !error
    && (directoryLoading || (hasMore && exhaustedIdentity !== identity)) };
}
