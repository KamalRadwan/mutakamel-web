"use client";

import { useEffect, useState } from "react";
import { useDashboardStore } from "../models/useDashboardStore";
import { DashboardHeader } from "./dashboard-header";
import { DashboardFilters } from "./dashboard-filters";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardGrid } from "./dashboard-grid";
import type { CrmDashboard, DashboardRunResult, CrmDashboardWidget } from "../models/dashboard-types";
import type { DashboardPointSelection } from "./renderers/dashboard-echarts-options";

interface DashboardViewProps {
  dashboard: CrmDashboard;
  initialResult?: DashboardRunResult;
}

export function DashboardView({ dashboard, initialResult }: DashboardViewProps) {
  const { initDashboard, setDateRange } = useDashboardStore();
  const [result, setResult] = useState<DashboardRunResult | undefined>(initialResult);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    initDashboard(dashboard);
  }, [dashboard, initDashboard]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call to fetch fresh data for all widgets
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handlePointSelect = (widget: CrmDashboardWidget, selection: DashboardPointSelection) => {
    // Phase 15: Drilldown routing will happen here.
    console.log(`Selected point in widget ${widget.name}:`, selection);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-black/95">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <DashboardHeader 
          dashboard={dashboard} 
          onRefresh={handleRefresh}
          onEditClick={() => {}} 
          onShareClick={() => {}} 
          isRefreshing={isRefreshing}
        />
        
        <DashboardFilters dashboard={dashboard} />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <DashboardGrid 
            runResult={result} 
            loading={isRefreshing} 
            onPointSelect={handlePointSelect}
          />
        </div>
      </div>

      {/* Studio Sidebar (Only visible in editMode) */}
      <DashboardSidebar />
    </div>
  );
}
