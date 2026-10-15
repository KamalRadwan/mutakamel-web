"use client";

import { useCallback, useRef, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { buildLeadCardPatchBody, type LeadCardPatch } from "../../lead-card-contract";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "../../lead-contract";
import { parseLeadDetailCard, type LeadDetailCard } from "../lead-detail-card-contract";

export interface LeadCardEdit {
  saving: boolean;
  error: NormalizedApiError | null;
  clearError: () => void;
  save: (patch: LeadCardPatch) => Promise<void>;
}

/**
 * Rating and card colour, written from the detail screen with the board's
 * own `PATCH /leads/:id { rating?, cardColor? }`. Nothing is shown as saved
 * until the server answers: the response carries both the lead and its card
 * fields, and an unknown outcome re-reads instead of keeping a guess.
 */
export function useLeadCardEdit(
  lead: LeadDetail | null,
  canEdit: boolean,
  onSaved: (lead: LeadDetail, card: LeadDetailCard) => void,
  onReconcile: () => void,
): LeadCardEdit {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const inFlight = useRef(false);

  const save = useCallback(
    async (patch: LeadCardPatch) => {
      const body = buildLeadCardPatchBody(patch);
      if (!lead || !canEdit || inFlight.current || Object.keys(body).length === 0) return;
      inFlight.current = true;
      setSaving(true);
      setError(null);
      try {
        const outcome = await runIdempotentWrite({
          attempt: createWriteAttempt(),
          method: "patch",
          path: leadPath(lead.id),
          body,
          parse: (payload) => ({
            lead: parseLeadDetailResponse(payload),
            card: parseLeadDetailCard(payload),
          }),
        });
        if (outcome.kind === "success") {
          onSaved(outcome.value.lead, outcome.value.card);
          return;
        }
        setError(outcome.error);
        if (outcome.kind !== "failed") onReconcile();
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [lead, canEdit, onSaved, onReconcile],
  );

  const clearError = useCallback(() => setError(null), []);

  return { saving, error, clearError, save };
}
