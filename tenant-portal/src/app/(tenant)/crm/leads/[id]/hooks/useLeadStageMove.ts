"use client";

import { useCallback, useState } from "react";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadStageItem } from "../../../lead-stages/lead-stage-contract";
import type { LeadDetail } from "../../lead-contract";

/**
 * A write that never reached a definite answer — a transport failure, or a 5xx
 * the server may still have applied. The same rule `useLeads` applies to the
 * same route, spelled the same way so the board and this screen cannot
 * disagree about what "we do not know" means.
 */
function isAmbiguousMutationError(error: unknown): boolean {
  return !(error instanceof TenantApiClientError) || error.response.status >= 500;
}

/**
 * A lead's stage, moved from the detail screen's own pipeline bar.
 *
 * **This is the board's move, not a second one.** Same route, same body, same
 * three refusals, so a stage cannot be reachable here and refused there:
 *
 *   POST /api/tenant/crm/v1/leads/:id/stage   { stageId }
 *
 * `nonReplayable` and `skipAutoIdempotency` are the board's flags too. The
 * route is `idempotent: false` in the Gateway contract — it carries no
 * idempotency key, and a transport retry must not re-send it, because a second
 * move is a second stage-change row in the audit log rather than a duplicate
 * the server would collapse.
 *
 * **It is also the WCAG 2.2 `dragging-alternative` this product owed.** With
 * "Move to…" gone from the board card, dragging was the only way to move a
 * lead; a stage bar a pointer can click is the single-pointer path that
 * requirement asks for, and a keyboard one for free.
 */
export interface LeadStageMove {
  move: (stageId: string) => Promise<void>;
  isMoving: boolean;
  error: string | null;
  clearError: () => void;
}

/** Conversion owns this stage; a stage move into it is refused server-side. */
const TERMINAL_STAGE_FLAG = "CONVERTED";

export function useLeadStageMove(
  lead: LeadDetail | null,
  stages: LeadStageItem[],
  canUpdate: boolean,
  reload: () => void,
): LeadStageMove {
  const { t } = useI18n();
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = useCallback(
    async (stageId: string) => {
      if (!lead || isMoving) return;
      // The same three refusals the board makes, in the same order, and each
      // says which one it was rather than letting the server answer 409.
      if (!canUpdate) {
        setError(t.crmLeads.messages.moveNotPermitted);
        return;
      }
      if (stages.find(({ id }) => id === lead.stageId)?.flag === TERMINAL_STAGE_FLAG) {
        setError(t.crmLeads.messages.convertedCannotMove);
        return;
      }
      const destination = stages.find(({ id }) => id === stageId);
      if (!destination || destination.flag === TERMINAL_STAGE_FLAG) {
        setError(t.crmLeads.messages.stageUnavailable);
        return;
      }

      setIsMoving(true);
      setError(null);
      try {
        await axiosClient.post<unknown>(
          `/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}/stage`,
          { stageId },
          {
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            maxResponseBytes: 256 * 1024,
          },
        );
        // Re-read rather than patch the row in place: the move also changes
        // `stageFlag`, `status` and `updatedAt`, and the history card below has
        // a new entry to show. The server owns all four.
        reload();
      } catch (caught) {
        // An ambiguous failure may have applied. Re-reading is what tells the
        // user which, and it is the one thing a retry must not assume.
        if (isAmbiguousMutationError(caught)) reload();
        setError(t.crmLeads.messages.moveFailed);
      } finally {
        setIsMoving(false);
      }
    },
    [lead, stages, canUpdate, isMoving, reload, t],
  );

  return { move, isMoving, error, clearError: () => setError(null) };
}
