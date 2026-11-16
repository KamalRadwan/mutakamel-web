"use client";
import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useOrgNodeOptions, useTenantUserOptions } from "@/app/(tenant)/core/hooks/useCoreOptions";
import { axiosClient } from "@/lib/api/axiosClient";
import { localizedName } from "@/lib/format/localized";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { PIPELINES_PATH, parsePipelinesResponse, type Pipeline } from "../../pipelines/pipeline-contract";
import { useWidgetSafety } from "./useWidgetSafety";
import { WIDGET_READ } from "./widget-requests";

export function useWidgetFilterOptions() {
  const { user } = useTenantAuth();
  const { lang } = useI18n();
  const safety = useWidgetSafety("filter-options");
  const branches = useOrgNodeOptions("branches", { enabled: user?.permissions.includes("org.branch.read") ?? false });
  const owners = useTenantUserOptions(user?.permissions.includes("users.user.read") ?? false);
  const [state, setState] = useState<{ scope: string; rows: Pipeline[]; error?: NormalizedApiError } | null>(null);
  const scope = safety.scope;
  const allowed = user?.permissions.includes("crm.pipelines.read") ?? false;
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    void axiosClient.get<unknown>(PIPELINES_PATH, { ...WIDGET_READ, signal: controller.signal })
      .then((response) => { const rows = parsePipelinesResponse(response.data); if (!controller.signal.aborted) setState({ scope, rows }); })
      .catch((caught) => { if (!controller.signal.aborted) setState({ scope, rows: [], error: normalizeApiError(caught) }); });
    return () => controller.abort();
  }, [allowed, scope]);
  return { branches: { ...branches, options: branches.options.filter((option) => user?.accessibleBranches.includes(option.value)) }, owners,
    pipelines: state?.scope === scope ? state.rows.map((pipeline) => ({ value: pipeline.id, label: localizedName(pipeline, lang) })) : [],
    pipelinesError: state?.scope === scope ? state.error : undefined, pipelinesUnavailable: !allowed,
    branchUnavailable: !user?.permissions.includes("org.branch.read"), ownerUnavailable: !user?.permissions.includes("users.user.read") };
}
