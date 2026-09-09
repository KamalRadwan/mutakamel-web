"use client";

import { useCallback, useRef, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import { createCrmWriteAttempt, runCrmWrite } from "../../../shared/crm-write";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "../../lead-contract";
import type { UpdateLeadRequest } from "../../lead-write-contract";

/** The company modal sends one validated PATCH of its changed company fields. */
export interface LeadCompanyEdit {
  /** The field key currently in flight, or `null`. */
  savingKey: string | null;
  error: NormalizedApiError | null;
  /** Prevent a fresh retry against an unresolved write; close and re-open after the re-read. */
  reconciliationRequired?: boolean;
  clearError: () => void;
  /**
   * Sends `request` and reports whether the value on screen is now the stored
   * one. An empty request is not sent — `buildLeadCompanyFieldRequest` returns
   * one for a value that cannot legally go on the wire — and answers `false`
   * so the caller keeps the box open rather than believing it saved.
   */
  save: (key: string, request: UpdateLeadRequest) => Promise<boolean>;
}

export function useLeadCompanyEdit(
  lead: LeadDetail | null,
  onSaved: (lead: LeadDetail) => void,
  /**
   * Re-read from the server — defect D2. Used where a write may have applied
   * and its result cannot be trusted, so the card shows what is stored rather
   * than what was typed.
   */
  onReconcile: () => void,
): LeadCompanyEdit {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const inFlight = useRef(false);

  const clearError = useCallback(() => {
    setError(null);
    setReconciliationRequired(false);
  }, []);

  const save = useCallback(
    async (key: string, request: UpdateLeadRequest) => {
      if (!lead || inFlight.current || reconciliationRequired || Object.keys(request).length === 0) return false;
      inFlight.current = true;
      setSavingKey(key);
      setError(null);
      const outcome = await runCrmWrite({
        attempt: createCrmWriteAttempt(),
        method: "patch",
        path: leadPath(lead.id),
        body: request,
        parse: parseLeadDetailResponse,
      });
      setSavingKey(null);
      inFlight.current = false;

      if (outcome.kind === "success") {
        onSaved(outcome.value);
        return true;
      }
      // Both may have applied. Re-read and block retrying this draft with a
      // fresh attempt; closing and reopening seeds the next draft from the read.
      if (outcome.kind === "applied_unreadable" || outcome.kind === "ambiguous") {
        setReconciliationRequired(true);
        onReconcile();
        setError(outcome.error);
        return false;
      }
      setError(outcome.error);
      return false;
    },
    [lead, onReconcile, onSaved, reconciliationRequired],
  );

  return { savingKey, error, reconciliationRequired, clearError, save };
}
