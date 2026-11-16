"use client";

import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { readMonthlyIntake } from "../../widget-monthly-intake";

export function WidgetMonthlyIntakeSummary({ data }: { data: NonNullable<ReturnType<typeof readMonthlyIntake>> }) {
  const { t, lang } = useI18n();
  const count = formatNumber(data.absoluteChange, lang, { signDisplay: "exceptZero" });
  const growth = data.growthPercent === null ? null : formatNumber(data.growthPercent, lang, {
    style: "unit", unit: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2,
  });
  return <p className="text-xs text-muted-foreground">
    {formatTemplate(t.crmDashboards.monthlyIntake.change, { count })}{growth && <> · <bdi>{growth}</bdi></>}
  </p>;
}
