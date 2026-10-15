"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, Star } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { LeadKpis } from "../lead-bulk-contract";

export interface LeadKpiStripProps {
  /** `POST /leads/kpis` for the applied search; nothing renders without it. */
  kpis: LeadKpis | null;
  /** The Basic search's `stageFlag` filter, which the New and Qualified toggles set. */
  stageFlag: string | undefined;
  onStageFlagChange: (flag: string | undefined) => void;
  disabled?: boolean;
}

/**
 * Pipeline-wide figures for the applied search.
 *
 * Only New and Qualified are filters, because a stage flag is a server filter
 * on the list. Rating and overdue activity have none (OPEN-QUESTIONS Q140), so
 * those two figures are shown and never offered as a filter that could only
 * narrow the rows already loaded while the figure described the whole pipeline.
 */
export function LeadKpiStrip({ kpis, stageFlag, onStageFlagChange, disabled }: LeadKpiStripProps) {
  const { t, lang } = useI18n();
  if (!kpis) return null;
  const labels = t.crmLeadWorkspace.kpis;
  const toggle = (flag: string) => onStageFlagChange(stageFlag === flag ? undefined : flag);

  return (
    <div role="group" aria-label={labels.label} className="flex flex-wrap items-center gap-1.5">
      <KpiToggle
        label={labels.total}
        value={formatNumber(kpis.totalLeads, lang)}
        pressed={stageFlag === undefined}
        disabled={disabled}
        onPress={() => onStageFlagChange(undefined)}
      />
      <KpiToggle
        label={labels.new}
        value={formatNumber(kpis.newStageLeads, lang)}
        hint={
          kpis.newTodayLeads > 0
            ? formatTemplate(labels.newToday, { count: formatNumber(kpis.newTodayLeads, lang) })
            : undefined
        }
        pressed={stageFlag === "NEW"}
        disabled={disabled}
        onPress={() => toggle("NEW")}
      />
      <KpiFigure icon={Star} label={labels.hot} value={formatNumber(kpis.hotLeads, lang)} />
      <KpiFigure
        icon={Activity}
        label={labels.overdue}
        value={formatNumber(kpis.overdueActivityLeads, lang)}
        alert={kpis.overdueActivityLeads > 0}
      />
      <KpiToggle
        label={labels.qualified}
        value={formatNumber(kpis.qualifiedLeads, lang)}
        pressed={stageFlag === "QUALIFIED"}
        disabled={disabled}
        onPress={() => toggle("QUALIFIED")}
      />
    </div>
  );
}

function KpiToggle({
  label,
  value,
  hint,
  pressed,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  pressed: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant={pressed ? "secondary" : "outline"}
      size="xs"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onPress}
      className="gap-1.5"
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
      {hint && <span className="text-muted-foreground">{hint}</span>}
    </Button>
  );
}

function KpiFigure({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
      <Icon className={cn(iconSize({ size: "sm" }), alert && "text-destructive")} aria-hidden="true" />
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}
