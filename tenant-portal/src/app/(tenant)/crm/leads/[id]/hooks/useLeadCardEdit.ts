"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
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
  const { t } = useI18n();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reconciliation, setReconciliation] = useState({ lead, pending: false });
  const inFlight = useRef(false);
  if (reconciliation.lead !== lead) setReconciliation({ lead, pending: false });

  const save = useCallback(
    async (patch: LeadCardPatch) => {
      const body = buildLeadCardPatchBody(patch);
      if (!lead || !canEdit || reconciliation.pending || inFlight.current || Object.keys(body).length === 0) return;
      inFlight.current = true;
      setSaving(true);
      setError(null);
      try {
        const outcome = await runIdempotentWrite({
          attempt: createWriteAttempt(),
          method: "patch",
          path: leadPath(lead.id),
          body: { ...body, expectedUpdatedAt: lead.updatedAt },
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
        const conflict = outcome.error.code === "CRM.LEAD.CONCURRENT_UPDATE" || outcome.error.status === 409;
        if (conflict) toast.warning(t.crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"], undefined, 0, { label: t.crmLeadDetail.reloadLead, onClick: onReconcile });
        if (outcome.kind !== "failed" || conflict) {
          setReconciliation((current) => ({ ...current, pending: true }));
          onReconcile();
        }
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [lead, canEdit, onSaved, onReconcile, reconciliation.pending, t, toast],
  );

  const clearError = useCallback(() => setError(null), []);

  return { saving, error, clearError, save };
}
