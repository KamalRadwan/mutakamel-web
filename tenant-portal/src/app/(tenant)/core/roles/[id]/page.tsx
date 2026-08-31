"use client";

import { use } from "react";
import { RoleEditorWorkspace } from "./components/role-editor-workspace";

export default function TenantRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RoleEditorWorkspace id={id} />;
}
