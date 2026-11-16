"use client";

import { useSearchParams } from "next/navigation";
import { replaceSearchParams } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
import { isUUIDv7 } from "@/lib/uuid";
import { useActivityDetail } from "./useActivityDetail";

export function useActivityDeepLink() {
  const params = useSearchParams();
  const candidate = params.get("activityId");
  const id = isUUIDv7(candidate) ? candidate : null;
  const { user } = useTenantAuth();
  const authorized = can(user, "activities.read");
  const detail = useActivityDetail(authorized ? id : null);
  return { id, authorized, detail, close: () => replaceSearchParams({ activityId: null }) };
}
