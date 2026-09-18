"use client";

import { useCallback, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityDetail } from "../../opportunity-contract";
import type { OpportunityStage } from "../../hooks/pipeline-types";
import { buildStageMoveRequest } from "../../hooks/usePipelineWorkspace";

export interface OpportunityStageMove {
  move: (stageId: string, terminalReason?: string) => Promise<boolean>;
  isMoving: boolean;
  error: string | null;
  clearError: () => void;
}

export function useOpportunityStageMove(
  opportunity: OpportunityDetail | null,
  stages: OpportunityStage[],
  canUpdate: boolean,
  reload: () => void,
): OpportunityStageMove {
  const { t } = useI18n();
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = useCallback(
    async (stageId: string, terminalReason?: string): Promise<boolean> => {
      if (!opportunity || isMoving || !canUpdate) return false;
      const targetStage = stages.find((s) => s.id === stageId);
      if (!targetStage) return false;

      setIsMoving(true);
      setError(null);

      try {
        await axiosClient.post(
          `/api/tenant/crm/v1/opportunities/${encodeURIComponent(opportunity.id)}/stage`,
          buildStageMoveRequest(stageId, targetStage.flag, terminalReason),
          {
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            maxResponseBytes: 512 * 1024,
          },
        );
        reload();
        return true;
      } catch (caught) {
        setError(caught instanceof Error && caught.message ? caught.message : t.crmOpportunityDetail.historyUnavailable);
        return false;
      } finally {
        setIsMoving(false);
      }
    },
    [opportunity, isMoving, canUpdate, stages, reload, t],
  );

  return {
    move,
    isMoving,
    error,
    clearError: () => setError(null),
  };
}
