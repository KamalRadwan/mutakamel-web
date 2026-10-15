"use client";

import { StageBar } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadKpis } from "../lead-bulk-contract";
import type { LeadStage } from "../hooks/useLeads";
import { LEAD_STAGE_BAR_TONE } from "./lead-view-config";

export interface LeadStageFunnelBarProps {
  stages: readonly LeadStage[];
  /** Per-stage counts come from `POST /leads/kpis`, never from the loaded page. */
  kpis: LeadKpis | null;
  value: readonly string[];
  onChange: (stageId: string | undefined) => void;
  disabled?: boolean;
}

/**
 * The stage filter above the Card and Table views.
 *
 * `byStage` lists only stages the search matched. With no stage chosen a
 * missing stage really holds none of the selection; once a stage is chosen the
 * others were filtered out of the question, so their counts are unknown and
 * the bar omits them along with the "every stage" total.
 */
export function LeadStageFunnelBar({ stages, kpis, value, onChange, disabled }: LeadStageFunnelBarProps) {
  const { t, lang } = useI18n();
  const stageChosen = value.length > 0;
  const counts = new Map(kpis?.byStage.map((row) => [row.stageId, row.total]));
  const countOf = (stageId: string): number | undefined =>
    counts.get(stageId) ?? (kpis && !stageChosen ? 0 : undefined);

  return (
    <StageBar
      label={t.crmLeads.stage}
      allLabel={t.crmLeads.basicSearch.any}
      allCount={kpis && !stageChosen ? kpis.totalLeads : undefined}
      steps={stages.map((stage) => ({
        id: stage.id,
        label: localizedName(stage, lang),
        count: countOf(stage.id),
        tone: LEAD_STAGE_BAR_TONE[stage.flag],
      }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
