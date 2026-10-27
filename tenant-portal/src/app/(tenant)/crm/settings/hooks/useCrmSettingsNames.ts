"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { localizedName, type BilingualName } from "@/lib/format/localized";
import { readLeadStageCatalogue } from "../../shared/lead-stage-catalogue";
import { PIPELINES_PATH, parsePipelinesResponse } from "../../pipelines/pipeline-contract";

export function useCrmSettingsNames(stageId: string | null | undefined, pipelineId: string | undefined) {
  const { lang, t } = useI18n();
  const { user } = useTenantAuth();
  const [stages, setStages] = useState<(BilingualName & { id: string })[]>([]);
  const [pipelines, setPipelines] = useState<(BilingualName & { id: string })[]>([]);
  const canReadStages = user?.permissions.includes("crm.lead_stages.read") ?? false;
  const canReadPipelines = user?.permissions.includes("crm.pipelines.read") ?? false;

  useEffect(() => {
    const controller = new AbortController();
    const config = { signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setStages([]);
      setPipelines([]);
      if (stageId && canReadStages) {
        void readLeadStageCatalogue(controller.signal)
          .then((items) => {
            if (!controller.signal.aborted) setStages(items);
          }).catch(() => { /* The display uses the explicit unavailable label. */ });
      }
      if (pipelineId && canReadPipelines) {
        void axiosClient.get<unknown>(PIPELINES_PATH, config)
          .then((response) => {
            const items = parsePipelinesResponse(response.data);
            if (!controller.signal.aborted) setPipelines(items);
          }).catch(() => { /* Settings remain usable without catalogue access. */ });
      }
    });
    return () => controller.abort();
  }, [stageId, pipelineId, canReadStages, canReadPipelines]);

  return {
    stageName: stageId == null ? t.crmSettings.notSet :
      localizedName(canReadStages ? stages.find((item) => item.id === stageId) : null, lang) || t.crmSettings.nameUnavailable,
    pipelineName: localizedName(canReadPipelines ? pipelines.find((item) => item.id === pipelineId) : null, lang) || t.crmSettings.nameUnavailable,
  };
}
