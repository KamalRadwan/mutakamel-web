"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { captureCategorySubmission, submitCategory, type CategoryCommand, type CategorySubmission } from "../category-api";
import type { CategoryReceipt } from "../category-contract";

type CommandState =
  | { kind: "idle" }
  | { kind: "pending"; submission: CategorySubmission }
  | { kind: "uncertain"; submission: CategorySubmission; error: NormalizedApiError }
  | { kind: "rejected"; error: NormalizedApiError }
  | { kind: "saved"; receipt: CategoryReceipt; replayed: boolean };

function uncertain(error: NormalizedApiError): boolean {
  // A read after an unacknowledged write cannot prove which command committed.
  return error.status === 0 || error.status >= 500 || error.status === 408
    || /(?:IN_FLIGHT|IN_PROGRESS|OUTCOME_UNKNOWN|AMBIGUOUS)/u.test(error.code ?? "");
}

/** No response here performs a follow-up read. A confirmed save stays saved. */
export function useCategoryCommand(enabled: boolean) {
  const [state, setState] = useState<CommandState>({ kind: "idle" });
  const inFlight = useRef(false);
  const unresolved = useRef<CategorySubmission | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const execute = async (submission: CategorySubmission): Promise<CategoryReceipt | null> => {
    if (!enabled || inFlight.current) return null;
    inFlight.current = true;
    unresolved.current = submission;
    setState({ kind: "pending", submission });
    try {
      const result = await submitCategory(submission);
      unresolved.current = null;
      if (mounted.current) setState({ kind: "saved", ...result });
      return result.receipt;
    } catch (thrown) {
      const error = normalizeApiError(thrown);
      if (uncertain(error)) {
        if (mounted.current) setState({ kind: "uncertain", submission, error });
      } else {
        unresolved.current = null;
        if (mounted.current) setState({ kind: "rejected", error });
      }
      return null;
    } finally {
      inFlight.current = false;
    }
  };
  return {
    state,
    submit: (command: CategoryCommand) => {
      if (!enabled || inFlight.current || unresolved.current) return Promise.resolve(null);
      return execute(captureCategorySubmission(command));
    },
    retry: () => unresolved.current ? execute(unresolved.current) : Promise.resolve(null),
    reset: () => { if (!inFlight.current && !unresolved.current) setState({ kind: "idle" }); },
  };
}
