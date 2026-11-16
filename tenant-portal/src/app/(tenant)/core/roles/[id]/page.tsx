"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { RoleEditorWorkspace } from "./components/role-editor-workspace";

export default function TenantRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <RoleEditorWorkspace
      id={id}
      onDeleted={() => router.push(TENANT_ROUTES.coreRoles)}
    />
  );
}
