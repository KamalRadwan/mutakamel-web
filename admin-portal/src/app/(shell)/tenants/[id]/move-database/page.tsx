"use client";

import { use } from "react";
import { TenantDatabaseRelocationScreen } from "@/features/admin/tenant-workspace/database-relocation";

export default function TenantMoveDatabasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TenantDatabaseRelocationScreen tenantId={use(params).id} />;
}
