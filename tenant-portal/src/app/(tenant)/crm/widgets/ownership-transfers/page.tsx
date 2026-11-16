"use client";

import { PermissionGate } from "@/design-system";
import { CRM_WIDGET_TRANSFER_PERMISSION } from "@/lib/navigation/tenant-routes";
import { WidgetOwnershipWorkspace } from "./components/WidgetOwnershipWorkspace";

export default function WidgetOwnershipPage() {
  return <PermissionGate require={CRM_WIDGET_TRANSFER_PERMISSION}><WidgetOwnershipWorkspace /></PermissionGate>;
}
