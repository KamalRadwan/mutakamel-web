"use client";

import { use } from "react";
import { UserDetailWorkspace } from "./components/user-detail-workspace";

export default function TenantUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UserDetailWorkspace id={id} />;
}
