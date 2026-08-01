"use client";

import { CrmDashboardWorkspace } from "@/features/crm/dashboards/components/crm-dashboard-workspace";
import { megaDemoDashboard, megaDemoRunResult } from "@/features/crm/dashboards/data/mega-demo-dashboard";

export default function MainCrmDashboardPage() {
  return (
    <div className="h-screen w-full">
      <CrmDashboardWorkspace dashboard={megaDemoDashboard} initialResult={megaDemoRunResult} />
    </div>
  );
}
