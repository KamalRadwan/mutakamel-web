"use client";

import { useCallback, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { isAmbiguousWriteFailure } from "@/lib/api/idempotent-write";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { opportunityPath, parseOpportunityDetailResponse, type OpportunityDetail } from "../../opportunity-contract";
import type { OpportunityStage } from "../../hooks/pipeline-types";
import { buildStageMoveRequest } from "../../hooks/usePipelineWorkspace";

export interface OpportunityStageMove {
  move: (stageId: string, terminalReason?: string) => Promise<boolean>;
  isMoving: boolean;
  uncertain: boolean;
  reconcile: () => Promise<boolean>;
  error: string | null;
  clearError: () => void;
}
interface PendingMove { id: string; pipelineId: string; stageId: string }

/** Stage POST is non-replayable. An uncertain response requires a known-record read. */
export function useOpportunityStageMove(opportunity: OpportunityDetail | null, stages: OpportunityStage[], canUpdate: boolean, reload: () => void): OpportunityStageMove {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const [isMoving, setIsMoving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const pending = useRef<PendingMove | null>(null);

  const reconcile = useCallback(async (): Promise<boolean> => {
    const intent = pending.current;
    if (!intent || sending.current) return false;
    sending.current = true; setIsMoving(true);
    try {
      const response = await axiosClient.get<unknown>(opportunityPath(intent.id), { cache: "no-store", maxResponseBytes: 512 * 1024 });
      const fresh = parseOpportunityDetailResponse(response.data);
      if (fresh.id !== intent.id) throw new Error("Opportunity identity changed");
      const applied = fresh.pipelineId === intent.pipelineId && fresh.stageId === intent.stageId;
      pending.current = null; setUncertain(false);
      setError(applied ? null : t.crmOpportunityDetail.form.stageReviewLatest);
      reload();
      return applied;
    } catch (caught) {
      setError(`${t.crmOpportunityDetail.form.stageOutcomeUnknown} ${describeError(normalizeApiError(caught)) ?? ""}`.trim());
      return false;
    } finally { sending.current = false; setIsMoving(false); }
  }, [reload, describeError, t]);

  const move = useCallback(async (stageId: string, terminalReason?: string): Promise<boolean> => {
    if (sending.current || !opportunity || !canUpdate) return false;
    if (pending.current) return reconcile();
    const target = stages.find((stage) => stage.id === stageId && stage.isActive);
    if (!target) return false;
    sending.current = true; setIsMoving(true); setError(null);
    pending.current = { id: opportunity.id, pipelineId: opportunity.pipelineId, stageId };
    try {
      await axiosClient.post(`${opportunityPath(opportunity.id)}/stage`, buildStageMoveRequest(stageId, target.flag, terminalReason), { nonReplayable: true, skipAutoIdempotency: true, cache: "no-store", maxResponseBytes: 512 * 1024 });
      pending.current = null; setUncertain(false); reload();
      return true;
    } catch (caught) {
      if (isAmbiguousWriteFailure(caught)) { setUncertain(true); setError(t.crmOpportunityDetail.form.stageOutcomeUnknown); }
      else { pending.current = null; setError(`${t.crmOpportunities.moveFailed} ${describeError(normalizeApiError(caught)) ?? ""}`.trim()); }
      return false;
    } finally { sending.current = false; setIsMoving(false); }
  }, [opportunity, canUpdate, stages, reload, reconcile, t, describeError]);

  return { move, isMoving, uncertain, reconcile, error, clearError: () => { if (!pending.current) setError(null); } };
}
