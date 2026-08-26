"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

interface DomainHealthGaugeChartProps {
  verified: number;
  unverified?: number;
  invalid: number;
  total: number;
  height?: number;
}

export function DomainHealthGaugeChart({
  verified,
  invalid,
  total,
  height = 40,
}: DomainHealthGaugeChartProps) {
  const { lang } = useI18n();

  if (total <= 0) return null;

  const data = [
    {
      category: "Domains",
      verified,
      invalid,
    },
  ];

  const names = {
    verified: lang === "ar" ? "مفعل ومثبت" : "Verified Active",
    invalid: lang === "ar" ? "ينتظر التفعيل / غير صالح" : "Pending / Invalid",
  };

  return (
    <div className="space-y-2">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, total]} hide />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="verified" name={names.verified} stackId="a" fill="#10b981" radius={[6, 0, 0, 6]} barSize={14} />
            <Bar dataKey="invalid" name={names.invalid} stackId="a" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-2xs font-semibold text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          <span>{names.verified}: <strong className="text-foreground">{verified}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warn-500" />
          <span>{names.invalid}: <strong className="text-foreground">{invalid}</strong></span>
        </div>
      </div>
    </div>
  );
}
