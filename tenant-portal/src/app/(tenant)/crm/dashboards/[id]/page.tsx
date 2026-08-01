"use client";

import { use } from "react";
import { CrmDashboardWorkspace } from "@/features/crm/dashboards/components/crm-dashboard-workspace";
import { megaDemoDashboard, megaDemoRunResult } from "@/features/crm/dashboards/data/mega-demo-dashboard";

export default function SingleDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  
  // Custom dashboard override if specific id requested, otherwise mega demo dashboard
  const currentDashboard = {
    ...megaDemoDashboard,
    id: resolvedParams.id,
  };

  return (
    <div className="h-screen w-full">
      <CrmDashboardWorkspace dashboard={currentDashboard} initialResult={megaDemoRunResult} />
    </div>
  );
}
