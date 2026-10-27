"use client";

import { useTenantAuth } from "@/context/AuthContext";
import { can, type PermissionTarget } from "@/lib/auth/permission-scope";

export function useCan(key: string, target?: PermissionTarget): boolean {
  const { user } = useTenantAuth();
  return can(user, key, target);
}
