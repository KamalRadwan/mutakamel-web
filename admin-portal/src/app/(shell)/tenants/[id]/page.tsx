"use client";

import { use } from "react";
import { TenantWorkspaceScreen } from "@/features/admin/tenant-workspace/TenantWorkspaceScreen";

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TenantWorkspaceScreen tenantId={id} />;
}
