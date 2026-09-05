"use client";

import { use } from "react";
import { TenantStorageMigrationScreen } from "@/features/admin/tenant-workspace/storage-migration";

export default function TenantMoveStoragePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TenantStorageMigrationScreen tenantId={use(params).id} />;
}
