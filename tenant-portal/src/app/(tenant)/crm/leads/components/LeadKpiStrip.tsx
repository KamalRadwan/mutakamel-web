"use client";

import { Activity, CircleCheck, CirclePlus, Layers, Star } from "lucide-react";
import { KpiBadge, type KpiBadgeTone } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { LeadKpis } from "../lead-bulk-contract";
import type { LeadQuickFilterPreset } from "../lead-search-contract";

interface LeadKpiStripProps {
  /** Figures over the base server search, before applying the selected pill. */
  kpis?: LeadKpis | null;
  activePreset: LeadQuickFilterPreset;
  onSelectPreset: (preset: LeadQuickFilterPreset) => void;
}

export function LeadKpiStrip({ kpis = null, activePreset, onSelectPreset }: LeadKpiStripProps) {
  const { t, lang } = useI18n();
  const labels = t.crmLeadWorkspace.kpis;
  const pills: ReadonlyArray<{
    preset: LeadQuickFilterPreset;
    tone: KpiBadgeTone;
    label: string;
    count: number | null;
    Icon: typeof Layers;
  }> = [
    { preset: "ALL", tone: "total", label: labels.total, count: kpis?.totalLeads ?? null, Icon: Layers },
    { preset: "NEW_STAGE", tone: "new", label: labels.new, count: kpis?.newStageLeads ?? null, Icon: CirclePlus },
    { preset: "HOT_3_STAR", tone: "rated", label: labels.hot, count: kpis?.hotLeads ?? null, Icon: Star },
    { preset: "QUALIFIED", tone: "qualified", label: labels.qualified, count: kpis?.qualifiedLeads ?? null, Icon: CircleCheck },
    { preset: "OVERDUE_ACTIVITY", tone: "overdue", label: labels.overdue, count: kpis?.overdueActivityLeads ?? null, Icon: Activity },
  ];

  return (
    <div role="region" aria-label={labels.label} className="flex flex-wrap items-center gap-1.5">
      {pills.map((pill) => (
        <div key={pill.preset} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <KpiBadge
            tone={pill.tone}
            label={pill.label}
            count={pill.count}
            icon={<pill.Icon />}
            pressed={activePreset === pill.preset}
            disabled={!kpis}
            onClick={() => onSelectPreset(activePreset === pill.preset ? "ALL" : pill.preset)}
          />
          {pill.preset === "NEW_STAGE" && kpis && kpis.newTodayLeads > 0 && (
            <span className="text-badge text-kpi-new-text">
              {labels.newToday.replace("{count}", formatNumber(kpis.newTodayLeads, lang))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
