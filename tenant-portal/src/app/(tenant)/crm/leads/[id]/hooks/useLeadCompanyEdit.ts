"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
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
  const { t } = useI18n();
  const toast = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [reconciliation, setReconciliation] = useState({ lead, pending: false });
  const inFlight = useRef(false);
  if (reconciliation.lead !== lead) setReconciliation({ lead, pending: false });

  const clearError = useCallback(() => {
    setError(null);
    if (!reconciliation.pending) setReconciliationRequired(false);
  }, [reconciliation.pending]);

  const save = useCallback(
    async (key: string, request: UpdateLeadRequest) => {
      if (!lead || inFlight.current || reconciliationRequired || Object.keys(request).length === 0) return false;
      inFlight.current = true;
      setSavingKey(key);
      setError(null);
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "patch",
        path: leadPath(lead.id),
        body: { ...request, expectedUpdatedAt: request.expectedUpdatedAt ?? lead.updatedAt },
        parse: parseLeadDetailResponse,
      });
      setSavingKey(null);
      inFlight.current = false;

      if (outcome.kind === "success") {
        onSaved(outcome.value);
        return true;
      }
      // Unknown outcomes and stale drafts need a read before a new attempt.
      // Closing and reopening then seeds the draft from the refreshed lead.
      const conflict = outcome.error.code === "CRM.LEAD.CONCURRENT_UPDATE" || outcome.error.status === 409;
      if (conflict) toast.warning(t.crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"], undefined, 0, { label: t.crmLeadDetail.reloadLead, onClick: onReconcile });
      if (outcome.kind === "applied_unreadable" || outcome.kind === "ambiguous" || conflict) {
        setReconciliationRequired(true);
        setReconciliation((current) => ({ ...current, pending: true }));
        onReconcile();
        setError(outcome.error);
        return false;
      }
      setError(outcome.error);
      return false;
    },
    [lead, onReconcile, onSaved, reconciliationRequired, t, toast],
  );

  return { savingKey, error, reconciliationRequired, clearError, save };
}
