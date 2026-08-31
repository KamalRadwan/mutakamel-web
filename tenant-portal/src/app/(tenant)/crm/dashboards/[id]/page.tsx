"use client";

import { use } from "react";
import { PermissionGate } from "@/design-system";
import { DashboardWorkspace } from "./components/dashboard-workspace";

export default function DashboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PermissionGate require="crm.dashboards.read" scoped>
      <DashboardWorkspace dashboardId={id} />
    </PermissionGate>
  );
}
