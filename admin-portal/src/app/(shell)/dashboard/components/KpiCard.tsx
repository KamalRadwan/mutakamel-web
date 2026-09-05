"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Users,
  CreditCard,
  Server,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Trash2,
  PauseCircle,
  CheckCircle2,
  Clock,
  Activity,
  XCircle,
} from "lucide-react";
import { DashboardMetric } from "@/types/dashboard";
import { useI18n } from "@/i18n/I18nContext";
import { StatCard, type StatTone } from "@/design-system";
import { formatDashboardMetric, metricToneToRole } from "../utils/formatters";
import {
  resolveMetricDescription,
  resolveMetricLabel,
  resolveTrendLabel,
} from "../utils/dashboard-copy";

interface KpiCardProps {
  card: DashboardMetric;
  currencyCode?: string;
  /** Tighter padding and a smaller number, for the overview's dense grid. */
  compact?: boolean;
}

function getCardIcon(key: string, label: string): LucideIcon {
  const k = (key + " " + label).toLowerCase();

  if (k.includes("deleted") || k.includes("trash")) return Trash2;
  if (k.includes("suspend") || k.includes("pause")) return PauseCircle;
  if (k.includes("provision") || k.includes("pending") || k.includes("progress")) return Clock;
  if (k.includes("fail") || k.includes("invalid") || k.includes("error")) return XCircle;
  if (k.includes("verify") || k.includes("verified") || k.includes("shield")) return ShieldCheck;
  if (k.includes("active") || k.includes("current")) return CheckCircle2;
  if (k.includes("tenant") || k.includes("company") || k.includes("building")) return Building2;
  if (k.includes("user") || k.includes("staff") || k.includes("member")) return Users;
  if (k.includes("subscrip") || k.includes("plan") || k.includes("tier")) return Activity;
  if (k.includes("invoice") || k.includes("collect") || k.includes("billing") || k.includes("money") || k.includes("paid")) return CreditCard;
  if (k.includes("server") || k.includes("db") || k.includes("database") || k.includes("capacity")) return Server;
  if (k.includes("alert") || k.includes("warn")) return ShieldAlert;
  if (k.includes("country") || k.includes("region") || k.includes("globe")) return Globe;

  return Building2;
}

export function KpiCard({ card, currencyCode = "USD", compact = false }: KpiCardProps) {
  const { lang, t } = useI18n();
  const formattedValue = formatDashboardMetric(card, currencyCode, lang);
  const tone: StatTone = metricToneToRole(card.tone);
  const icon = getCardIcon(card.key, card.label);

  return (
    <StatCard
      label={resolveMetricLabel(card, lang, t)}
      value={formattedValue}
      description={resolveMetricDescription(card, lang, t)}
      icon={icon}
      tone={tone}
      compact={compact}
      trend={
        card.trend && {
          ...card.trend,
          // The series name is Core's vocabulary, so it translates like every
          // other label the reports author.
          label: resolveTrendLabel(card.trend.label, t),
        }
      }
    />
  );
}
