"use client";

import { use } from "react";
import { PermissionGate } from "@/design-system";
import { WidgetDetailWorkspace } from "./components/widget-detail-workspace";

export default function WidgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PermissionGate require="crm.widgets.read">
      <WidgetDetailWorkspace widgetId={id} />
    </PermissionGate>
  );
}
