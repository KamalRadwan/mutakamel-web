"use client";

import { TenantProvisioningWorkspaceView } from "./TenantProvisioningWorkspaceView";
import { useTenantProvisioningWorkspace } from "../hooks/useTenantProvisioningWorkspace";

export interface TenantProvisioningWorkspaceProps {
  tenantId: string;
}

export function TenantProvisioningWorkspace({
  tenantId,
}: TenantProvisioningWorkspaceProps) {
  const model = useTenantProvisioningWorkspace(tenantId);
  return <TenantProvisioningWorkspaceView model={model} />;
}
