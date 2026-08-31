"use client";

import { use } from "react";
import { DashboardWorkspace } from "./components/dashboard-workspace";

export default function TradeDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DashboardWorkspace dashboardId={id} />;
}
