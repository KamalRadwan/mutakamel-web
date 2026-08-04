"use client";

import { Bar } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import { BaseBarChart } from "./BaseBarChart";

export interface RenewalsDataPoint {
  month: string;
  renewals: number;
}

interface Props {
  data: RenewalsDataPoint[];
  height?: number;
}

export function SubscriptionRenewalsBarChart({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <BaseBarChart
      data={data}
      height={height}
      yDataKey="month"
    >
      <Bar
        dataKey="renewals"
        name={lang === "ar" ? "التجديدات القادمة" : "Upcoming Renewals"}
        fill="#3b82f6"
        radius={[0, 4, 4, 0]}
        barSize={16}
      />
    </BaseBarChart>
  );
}
