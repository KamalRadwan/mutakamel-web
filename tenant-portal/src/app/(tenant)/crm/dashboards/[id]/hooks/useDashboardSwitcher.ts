"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  DASHBOARDS_NAVIGATION_PATH,
  DASHBOARD_TEMPLATE_KEYS,
  dashboardFromTemplatePath,
  parseDashboardDetailResponse,
  parseNavigationResponse,
  type DashboardNavigationItem,
  type DashboardTemplateKey,
} from "../../dashboard-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
const WRITE_CONFIG = { maxResponseBytes: 1024 * 1024 } as const;

export const STANDARD_TEMPLATE_LABELS: Record<DashboardTemplateKey, { en: string; ar: string }> = {
  CRM_DEFAULT: { en: "CRM Default", ar: "لوحة CRM الافتراضية" },
  SALES_PIPELINE: { en: "Sales Pipeline", ar: "مسار المبيعات" },
  LEAD_PERFORMANCE: { en: "Lead Performance", ar: "أداء العملاء المحتملين" },
  KPIS_TARGETS: { en: "KPIs & Targets", ar: "المؤشرات والأهداف" },
  TRENDS_COMPARISONS: { en: "Trends & Comparisons", ar: "الاتجاهات والمقارنات" },
  DISTRIBUTION_RELATIONSHIPS: { en: "Distribution & Relationships", ar: "التوزيع والعلاقات" },
  PROCESS_OPERATIONS: { en: "Process & Operations", ar: "العمليات والتشغيل" },
  ACTIVITIES_PRODUCTIVITY: { en: "Activities & Productivity", ar: "الأنشطة والإنتاجية" },
  CUSTOMER_INTELLIGENCE: { en: "Customer Intelligence", ar: "ذكاء العملاء" },
  DATA_QUALITY: { en: "Data Quality", ar: "جودة البيانات" },
  ACTION_CENTER: { en: "Action Center", ar: "مركز الإجراءات" },
};

export function useDashboardSwitcher() {
  const [items, setItems] = useState<DashboardNavigationItem[]>([]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const response = await axiosClient.get<unknown>(DASHBOARDS_NAVIGATION_PATH, READ_CONFIG);
      setItems(parseNavigationResponse(response.data).items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const ensureTemplateDashboard = useCallback(
    async (templateKey: DashboardTemplateKey): Promise<string | null> => {
      try {
        const response = await axiosClient.put<unknown>(
          dashboardFromTemplatePath(templateKey),
          {},
          WRITE_CONFIG,
        );
        const detail = parseDashboardDetailResponse(response.data);
        await load();
        return detail.id;
      } catch {
        return null;
      }
    },
    [load],
  );

  const existingNames = new Set(items.map((item) => item.name.trim().toLowerCase()));
  const unprovisionedTemplates = DASHBOARD_TEMPLATE_KEYS.filter(
    (key) =>
      !existingNames.has(STANDARD_TEMPLATE_LABELS[key].en.toLowerCase()) &&
      !existingNames.has(STANDARD_TEMPLATE_LABELS[key].ar.toLowerCase()),
  );

  return { items, reload: load, unprovisionedTemplates, ensureTemplateDashboard };
}

