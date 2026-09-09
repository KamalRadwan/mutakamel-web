"use client";

import { useTenantAuth } from "@/context/AuthContext";
import { PermissionGate } from "@/design-system";
import { AddonSeatWorkspace } from "../components/AddonSeatWorkspace";

export default function AddonSeatsPage() {
  const { user, isAuthenticated } = useTenantAuth();
  if (!isAuthenticated || !user) return <PermissionGate require={[]} denied>{null}</PermissionGate>;
  return <AddonSeatWorkspace userId={user.id} />;
}
