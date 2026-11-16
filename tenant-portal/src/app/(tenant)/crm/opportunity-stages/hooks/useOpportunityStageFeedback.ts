"use client";

import { useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { classifyApiOutcome } from "@/lib/api/outcomes";
import type { StageWriteResult } from "./useOpportunityStages";

export function isUncertainStageWrite(error: NormalizedApiError): boolean {
  if (classifyApiOutcome(error) !== "other") return false;
  return (error.status === 0 && !error.code?.startsWith("OPPORTUNITY_STAGE_")) || error.status >= 500;
}

export function useOpportunityStageFeedback(reload: () => Promise<boolean>) {
  const { t } = useI18n();
  const toast = useToast();
  const [failure, setFailure] = useState<NormalizedApiError | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string>();
  const describe = (error: NormalizedApiError) => error.status === 403 ? t.crmOpportunityStages.writeForbidden : isUncertainStageWrite(error) ? t.crmOpportunityStages.uncertain : error.code === "OPPORTUNITY_STAGE_IN_USE" ? t.crmOpportunityStages.inUseAction : t.crmOpportunityStages.errors[error.code ?? ""] ?? t.crmOpportunityStages.actionFailed;

  return {
    failure, blocked, reconciling,
    message: reconcileMessage ?? (failure ? describe(failure) : undefined),
    clear: () => { if (!blocked) { setFailure(null); setReconcileMessage(undefined); } },
    report: (result: StageWriteResult, successTitle: string) => {
      if (result.ok) {
        setFailure(null);
        setBlocked(false);
        setReconcileMessage(undefined);
        if (result.replayed) toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
        else toast.success(successTitle);
        return true;
      }
      if (result.error) {
        setFailure(result.error);
        setReconcileMessage(undefined);
        setBlocked(isUncertainStageWrite(result.error));
        toast.outcomeFromApi(result.error);
      }
      return false;
    },
    reconcile: async () => {
      if (reconciling) return;
      setReconciling(true);
      const loaded = await reload();
      setReconciling(false);
      setBlocked(!loaded);
      if (loaded) setFailure(null);
      setReconcileMessage(loaded ? t.crmOpportunityStages.reconciled : t.crmOpportunityStages.reconcileFailed);
    },
  };
}
