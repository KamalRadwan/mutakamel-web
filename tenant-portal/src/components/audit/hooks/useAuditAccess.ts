"use client";
import { useTenantAuth } from "@/context/AuthContext";
import { canReadAudit } from "@/lib/audit/permissions";

export function useAuditAccess() {
  const { user } = useTenantAuth();
  return canReadAudit(user?.permissions ?? []);
}
