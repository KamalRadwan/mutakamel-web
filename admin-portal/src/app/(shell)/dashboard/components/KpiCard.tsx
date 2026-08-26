"use client";

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
import { formatDashboardMetric, toneToColorStyle } from "../utils/formatters";

interface KpiCardProps {
  card: DashboardMetric;
  currencyCode?: string;
}

export function getCardIcon(key: string, label: string) {
  const k = (key + " " + label).toLowerCase();

  if (k.includes("deleted") || k.includes("trash")) return <Trash2 className="w-4 h-4" />;
  if (k.includes("suspend") || k.includes("pause")) return <PauseCircle className="w-4 h-4" />;
  if (k.includes("provision") || k.includes("pending") || k.includes("progress")) return <Clock className="w-4 h-4" />;
  if (k.includes("fail") || k.includes("invalid") || k.includes("error")) return <XCircle className="w-4 h-4" />;
  if (k.includes("verify") || k.includes("verified") || k.includes("shield")) return <ShieldCheck className="w-4 h-4" />;
  if (k.includes("active") || k.includes("current")) return <CheckCircle2 className="w-4 h-4" />;
  if (k.includes("tenant") || k.includes("company") || k.includes("building")) return <Building2 className="w-4 h-4" />;
  if (k.includes("user") || k.includes("staff") || k.includes("member")) return <Users className="w-4 h-4" />;
  if (k.includes("subscrip") || k.includes("plan") || k.includes("tier")) return <Activity className="w-4 h-4" />;
  if (k.includes("invoice") || k.includes("collect") || k.includes("billing") || k.includes("money") || k.includes("paid")) return <CreditCard className="w-4 h-4" />;
  if (k.includes("server") || k.includes("db") || k.includes("database") || k.includes("capacity")) return <Server className="w-4 h-4" />;
  if (k.includes("alert") || k.includes("warn")) return <ShieldAlert className="w-4 h-4" />;
  if (k.includes("country") || k.includes("region") || k.includes("globe")) return <Globe className="w-4 h-4" />;

  return <Building2 className="w-4 h-4" />;
}

export function KpiCard({ card, currencyCode = "USD" }: KpiCardProps) {
  const formattedValue = formatDashboardMetric(card, currencyCode);
  const style = toneToColorStyle(card.tone);
  const icon = getCardIcon(card.key, card.label);

  return (
    <div
      className={`bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 ${style.topBorder} shadow-2xs space-y-3 flex flex-col justify-between overflow-hidden relative group hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]" title={card.label}>
            {card.label}
          </span>
          <div className={`p-2 rounded-xl ${style.iconBg} ${style.iconColor} shrink-0`}>
            {icon}
          </div>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {formattedValue}
          </span>
        </div>

        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
          {card.description}
        </p>
      </div>

      <div
        className={`h-1 w-12 rounded-full ${style.iconColor} opacity-60 bg-current`}
        aria-hidden="true"
      />
    </div>
  );
}
