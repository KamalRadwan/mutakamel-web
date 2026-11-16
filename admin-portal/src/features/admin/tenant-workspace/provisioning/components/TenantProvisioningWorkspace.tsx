"use client";

import { TenantProvisioningWorkspaceView } from "./TenantProvisioningWorkspaceView";
import { useTenantProvisioningWorkspace } from "../hooks/useTenantProvisioningWorkspace";

export interface TenantProvisioningWorkspaceProps {
  tenantId: string;
  tenantName: string;
}

export function TenantProvisioningWorkspace({
  tenantId,
  tenantName,
}: TenantProvisioningWorkspaceProps) {
  const model = useTenantProvisioningWorkspace(tenantId, tenantName);
  return <TenantProvisioningWorkspaceView model={model} />;
}
