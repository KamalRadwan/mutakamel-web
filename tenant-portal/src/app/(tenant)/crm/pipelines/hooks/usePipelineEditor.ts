"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { UpdatePipelineInput } from "../pipeline-contract";
import type { usePipelineDetail } from "./usePipelineDetail";
import { usePipelineFeedback } from "./usePipelineFeedback";
import { isUncertainPipelineWrite } from "./pipeline-uncertainty";

export function usePipelineEditor(detail: ReturnType<typeof usePipelineDetail>, canManage: boolean, onSaved: () => void) {
  const { t } = useI18n();
  const feedback = usePipelineFeedback();
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);

  return {
    error, uncertain,
    clear: () => { setError(undefined); setUncertain(false); },
    reconcile: async () => {
      if (await detail.reload()) { setUncertain(false); setError(undefined); }
    },
    save: async (input: UpdatePipelineInput) => {
      if (!canManage || uncertain || detail.isPending()) return;
      const result = await detail.save(input);
      if (result.stale) return;
      if (result.ok) {
        feedback.report(result, t.crmPipelines.updated);
        onSaved();
      } else {
        const unknown = isUncertainPipelineWrite(result.error);
        setUncertain(unknown);
        setError(unknown ? t.crmPipelines.review.uncertainWrite : result.error ? feedback.describeFailure(result.error) : undefined);
        if (result.error) feedback.outcome(result.error);
      }
    },
  };
}
