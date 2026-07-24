"use client";

import { useMemo } from "react";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Server, 
  Database, 
  ShieldCheck, 
  ShieldAlert, 
  Globe, 
  Trash2, 
  PauseCircle, 
  CheckCircle2, 
  Clock, 
  Activity,
  XCircle
} from "lucide-react";
import { DashboardMetric } from "@/types/dashboard";
import { formatDashboardMetric, toneToColorClass } from "../utils/formatters";
import { SparklineChart } from "./charts/SparklineChart";

interface KpiCardProps {
  card: DashboardMetric;
  currencyCode?: string;
}

const toneToHexColor: Record<string, string> = {
  amber: "#f59e0b",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  green: "#10b981",
  purple: "#8b5cf6",
  red: "#ef4444",
};

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
  const toneColor = toneToColorClass(card.tone);
  const sparkColor = toneToHexColor[card.tone] || "#3b82f6";
  const icon = getCardIcon(card.key, card.label);

  const sparkData = useMemo(() => {
    const numVal = typeof card.value === "number" ? card.value : parseFloat(String(card.value)) || 10;
    const base = Math.max(numVal, 5);
    return [
      { value: Math.round(base * 0.65) },
      { value: Math.round(base * 0.8) },
      { value: Math.round(base * 0.72) },
      { value: Math.round(base * 0.9) },
      { value: Math.round(base) },
    ];
  }, [card.value]);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 flex flex-col justify-between overflow-hidden relative group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold truncate max-w-[140px]" title={card.label}>
            {card.label}
          </span>
          <div className={`p-1.5 sm:p-2 rounded-xl ${toneColor.split(" ")[1]}`}>
            <div className={toneColor.split(" ")[0]}>
              {icon}
            </div>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {formattedValue}
          </span>
        </div>

        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
          {card.description}
        </p>
      </div>

      <div className="pt-2 -mb-2 -mx-2 opacity-80 group-hover:opacity-100 transition-opacity">
        <SparklineChart data={sparkData} color={sparkColor} height={32} />
      </div>
    </div>
  );
}
