"use client";

import { useEffect, useMemo, useState } from "react";
import type { CorePath } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import { coreGet } from "../../../core-api";
import {
  SEQUENCE_NOT_FOUND_CODE,
  numberingPeekPath,
  parseNumberingPeekResponse,
  type NumberingPeek,
} from "../numbering-contract";

const PEEK_DEBOUNCE_MS = 350;
const PEEK_RESPONSE_LIMIT_BYTES = 10_000;

export type NumberingPeekStatus = "idle" | "loading" | "found" | "notFound" | "failed";

interface PeekResult {
  /** Which request this answer belongs to; a stale answer is simply ignored. */
  readonly path: CorePath;
  readonly peek: NumberingPeek | null;
  readonly status: "found" | "notFound" | "failed";
}

/**
 * `GET /numbering/:code/peek` consumes nothing, so it is safe to call while the
 * user types. It answers with the sequence's authoritative `nextValue` and the
 * server's own `formatted` rendering of it, which is what makes the form's live
 * preview verifiable rather than a guess.
 *
 * `idle` and `loading` are derived during render from the request the form
 * currently implies — never written by the effect, which only ever commits a
 * settled answer from inside its own callback.
 */
export function useNumberingPeek(code: string, companyId: string | null) {
  const [result, setResult] = useState<PeekResult | null>(null);

  const path = useMemo<CorePath | null>(() => {
    try {
      return numberingPeekPath(code, companyId);
    } catch {
      // An incomplete or malformed code is not a failure, it is "nothing to
      // ask yet" — the route would reject it before reaching the sequence.
      return null;
    }
  }, [code, companyId]);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await coreGet(path, {
            signal: controller.signal,
            maxResponseBytes: PEEK_RESPONSE_LIMIT_BYTES,
          });
          if (controller.signal.aborted) return;
          setResult({ path, peek: parseNumberingPeekResponse(response.data), status: "found" });
        } catch (error) {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(error);
          // A 404 is not a failure here: it is how the form learns the code is
          // still free, which is exactly what a create form needs to know.
          const status =
            normalized.status === 404 || normalized.code === SEQUENCE_NOT_FOUND_CODE
              ? "notFound"
              : "failed";
          setResult({ path, peek: null, status });
        }
      })();
    }, PEEK_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path]);

  const isCurrent = path !== null && result?.path === path;
  const status: NumberingPeekStatus =
    path === null ? "idle" : isCurrent ? result.status : "loading";

  return { peek: isCurrent ? result.peek : null, status };
}
