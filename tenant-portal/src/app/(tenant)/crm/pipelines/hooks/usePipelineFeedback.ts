"use client";

import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { PipelineWriteResult } from "./usePipelines";

export function usePipelineFeedback() {
  const { t } = useI18n();
  const toast = useToast();
  const describeFailure = (error: NormalizedApiError) =>
    t.crmPipelines.errors[error.code ?? ""] ?? t.crmPipelines.actionFailed;
  const report = (result: PipelineWriteResult | null, title: string) => {
    if (!result) return false;
    if (result.stale) return false;
    if (result.ok) {
      if (result.replayed) toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
      else toast.success(title);
      return true;
    }
    if (result.error && !toast.outcomeFromApi(result.error)) {
      toast.errorFromApi(result.uncertain ? t.crmPipelines.review.uncertainWrite : describeFailure(result.error), result.error);
    }
    return false;
  };
  return { describeFailure, report, outcome: toast.outcomeFromApi };
}
