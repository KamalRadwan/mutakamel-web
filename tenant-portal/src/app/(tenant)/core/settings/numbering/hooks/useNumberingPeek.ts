"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CorePath } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import { fetchNumberingPeek } from "../numbering-api";
import {
  SEQUENCE_NOT_FOUND_CODE,
  numberingPeekPath,
  type NumberingPeek,
} from "../numbering-contract";
import { isAbortError } from "../numbering-errors";

const PEEK_DEBOUNCE_MS = 350;

export type NumberingPeekStatus = "idle" | "loading" | "found" | "notFound" | "failed";

interface PeekResult {
  /** Which request this answer belongs to; a stale answer is simply ignored. */
  readonly path: CorePath;
  readonly attempt: number;
  readonly peek: NumberingPeek | null;
  readonly status: "found" | "notFound" | "failed";
}

/**
 * Read the saved sequence only in edit mode. Creation uses the local formatter
 * and lets POST report code conflicts instead of probing missing sequences.
 *
 * `idle` and `loading` are derived during render from the request the form
 * currently implies — never written by the effect, which only ever commits a
 * settled answer from inside its own callback.
 */
export function useNumberingPeek(code: string, companyId: string | null, enabled: boolean) {
  const [result, setResult] = useState<PeekResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const path = useMemo<CorePath | null>(() => {
    if (!enabled) return null;
    try {
      return numberingPeekPath(code, companyId);
    } catch {
      // An incomplete or malformed code is not a failure, it is "nothing to
      // ask yet" — the route would reject it before reaching the sequence.
      return null;
    }
  }, [code, companyId, enabled]);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    const delayMs = attempt > 0 ? 0 : PEEK_DEBOUNCE_MS;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const peek = await fetchNumberingPeek(path, controller.signal);
          if (controller.signal.aborted) return;
          setResult({ path, attempt, peek, status: "found" });
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) return;
          const normalized = normalizeApiError(error);
          // An existing sequence may have been removed since the list loaded.
          const status =
            normalized.status === 404 || normalized.code === SEQUENCE_NOT_FOUND_CODE
              ? "notFound"
              : "failed";
          setResult({ path, attempt, peek: null, status });
        }
      })();
    }, delayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, attempt]);

  const isCurrent = path !== null && result?.path === path && result.attempt === attempt;
  const status: NumberingPeekStatus =
    path === null ? "idle" : isCurrent ? result.status : "loading";

  return { peek: isCurrent ? result.peek : null, status, retry };
}
