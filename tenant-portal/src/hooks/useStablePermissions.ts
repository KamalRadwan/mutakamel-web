"use client";

import { useMemo } from "react";
import type { TenantUserProfile } from "@/context/AuthContext";

/** A profile refresh must not restart reads when its grants are unchanged. */
export function useStablePermissions(user: Pick<TenantUserProfile, "permissions"> | null) {
  const key = user?.permissions.join("\n") ?? "";
  return useMemo(() => key ? key.split("\n") : [], [key]);
}
