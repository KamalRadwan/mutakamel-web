"use client";

import { useCrmDashboardWorkspace } from "../hooks/useCrmDashboardWorkspace";
import { CrmDashboardNavbar } from "./crm-dashboard-navbar";
import { CrmDashboardToolbar } from "./crm-dashboard-toolbar";
import { DashboardGrid } from "./dashboard-grid";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardDrilldownPanel } from "./dashboard-drilldown-panel";
import type { CrmDashboard, DashboardRunResult } from "../models/dashboard-types";

interface CrmDashboardWorkspaceProps {
  dashboard?: CrmDashboard;
  initialResult?: DashboardRunResult;
}

export function CrmDashboardWorkspace({ dashboard, initialResult }: CrmDashboardWorkspaceProps) {
  const {
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
  } = useCrmDashboardWorkspace({ dashboard, initialResult });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-black/95">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <CrmDashboardNavbar
          activeDashboard={activeDashboard}
          availableDashboards={availableDashboards}
          onSelectDashboard={selectDashboard}
        />
        <CrmDashboardToolbar onRefresh={handleRefresh} isRefreshing={isRefreshing} />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <DashboardGrid
            runResult={result}
            loading={isRefreshing}
            onPointSelect={handlePointSelect}
          />
        </div>
      </div>

      <DashboardSidebar />

      <DashboardDrilldownPanel
        open={drilldownOpen}
        onClose={closeDrilldown}
        title={drilldownTitle}
        records={drilldownRecords}
        isLoading={isDrilldownLoading}
      />
    </div>
  );
}
