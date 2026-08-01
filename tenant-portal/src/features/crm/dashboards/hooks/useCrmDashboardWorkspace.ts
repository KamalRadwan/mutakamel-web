import { useEffect, useState, useCallback } from "react";
import { useDashboardStore } from "../models/useDashboardStore";
import type { CrmDashboard, DashboardRunResult, CrmDashboardWidget, DashboardDrilldownRecord } from "../models/dashboard-types";
import type { DashboardPointSelection } from "../components/renderers/dashboard-echarts-options";
import { handleCrossFiltering } from "../utils/cross-filtering";
import { megaDemoDashboard, megaDemoRunResult } from "../data/mega-demo-dashboard";

const defaultAvailableDashboards: CrmDashboard[] = [
  megaDemoDashboard,
  {
    id: "sales-overview",
    name: "ملخص المبيعات (Sales Overview)",
    description: "الأداء العام للمبيعات وحجم الصفقات",
    accessLevel: "EDIT",
    revision: 1,
    placements: megaDemoDashboard.placements.slice(0, 8),
  },
  {
    id: "marketing-performance",
    name: "أداء الحملات التسويقية (Marketing Performance)",
    description: "تحليل قناة العملاء واستقطاب الفرص",
    accessLevel: "EDIT",
    revision: 1,
    placements: megaDemoDashboard.placements.slice(8, 16),
  },
];

interface UseCrmDashboardWorkspaceOptions {
  dashboard?: CrmDashboard;
  initialResult?: DashboardRunResult;
}

export function useCrmDashboardWorkspace(options: UseCrmDashboardWorkspaceOptions = {}) {
  const { initDashboard, filters, setFilters } = useDashboardStore();

  const [activeDashboard, setActiveDashboard] = useState<CrmDashboard>(
    options.dashboard || megaDemoDashboard
  );
  const [result, setResult] = useState<DashboardRunResult | undefined>(
    options.initialResult || megaDemoRunResult
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableDashboards] = useState<CrmDashboard[]>(defaultAvailableDashboards);

  // Drilldown State
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownRecords, setDrilldownRecords] = useState<DashboardDrilldownRecord[]>([]);
  const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);

  useEffect(() => {
    initDashboard(activeDashboard);
  }, [activeDashboard, initDashboard]);

  const selectDashboard = useCallback((dashboardId: string) => {
    const found = availableDashboards.find((d) => d.id === dashboardId);
    if (found) {
      setActiveDashboard(found);
      setResult({
        ...megaDemoRunResult,
        dashboardId: found.id,
      });
    }
  }, [availableDashboards]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate API fetch refresh
    await new Promise((r) => setTimeout(r, 800));
    setResult({
      ...megaDemoRunResult,
      generatedAt: new Date().toISOString(),
    });
    setIsRefreshing(false);
  }, []);

  const handlePointSelect = useCallback(async (widget: CrmDashboardWidget, selection: DashboardPointSelection) => {
    handleCrossFiltering(widget, selection, setFilters, filters);

    setDrilldownTitle(`Drilldown: ${widget.name} - ${selection.seriesKey || selection.pointKey}`);
    setDrilldownOpen(true);
    setIsDrilldownLoading(true);

    await new Promise((r) => setTimeout(r, 600));
    setDrilldownRecords([
      { id: "1", title: "مشروع التحديث الرقمي - البنك الأهلي", amount: 850000, status: "WON" },
      { id: "2", title: "منظومة الاتصالات السحابية - موبايلي", amount: 620000, status: "OPEN" },
      { id: "3", title: "بوابة خدمات العملاء - وزارة الصحة", amount: 1200000, status: "WON" },
      { id: "4", title: "منصة الذكاء الاصطناعي - سدايا", amount: 940000, status: "WON" },
    ]);
    setIsDrilldownLoading(false);
  }, [filters, setFilters]);

  const closeDrilldown = useCallback(() => {
    setDrilldownOpen(false);
  }, []);

  return {
    activeDashboard,
    result,
    isRefreshing,
    availableDashboards,
    selectDashboard,
    handleRefresh,
    handlePointSelect,
    drilldownOpen,
    drilldownTitle,
    drilldownRecords,
    isDrilldownLoading,
    closeDrilldown,
  };
}
