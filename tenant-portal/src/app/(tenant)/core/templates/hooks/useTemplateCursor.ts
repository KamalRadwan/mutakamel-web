"use client";

import { useCallback, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import { CURSOR_INVALID_CODE } from "../template-lifecycle-contract";

/**
 * True when the failure was a dead cursor rather than a real error.
 *
 * Module-level on purpose: a fetch callback has to depend on it, and a function
 * rebuilt with the hook's return object every render would make that callback a
 * new value every render — which is an effect that re-runs forever.
 */
export function isExpiredCursor(error: NormalizedApiError): boolean {
  return error.code === CURSOR_INVALID_CODE;
}

/**
 * Forward/back paging over HMAC-signed cursors.
 *
 * The cursors are opaque, signed over their own bytes, bound to a query
 * fingerprint and valid for fifteen minutes. They are therefore held **in
 * memory only** — never parsed, never re-encoded, never written to the URL or
 * to storage, because a reload would hand back a value the server can no longer
 * verify. The trail of already-used cursors is what makes "previous" possible
 * without a page number the endpoint does not have.
 *
 * An expired or re-fingerprinted cursor is `CORE.TEMPLATE.CURSOR.INVALID`, and
 * the correct response is to **restart the list**, not to retry the same value.
 */
export function useTemplateCursor() {
  const [trail, setTrail] = useState<(string | undefined)[]>([undefined]);
  const [index, setIndex] = useState(0);
  const [wasReset, setWasReset] = useState(false);

  const restart = useCallback((becauseExpired: boolean) => {
    setTrail([undefined]);
    setIndex(0);
    setWasReset(becauseExpired);
  }, []);

  return {
    cursor: trail[index],
    pageNumber: index + 1,
    canGoBack: index > 0,
    wasReset,
    // Paging again makes the "we restarted the list" notice stale, so both
    // movements clear it.
    advance: (nextCursor: string | null) => {
      if (!nextCursor) return;
      setWasReset(false);
      setTrail((current) => [...current.slice(0, index + 1), nextCursor]);
      setIndex((current) => current + 1);
    },
    goBack: () => {
      setWasReset(false);
      setIndex((current) => Math.max(0, current - 1));
    },
    restart,
  };
}
