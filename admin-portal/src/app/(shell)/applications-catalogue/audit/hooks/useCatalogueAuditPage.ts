import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type {
  CatalogueAuditEntityType,
  CatalogueAuditPageView,
} from "@/features/admin/applications/types";
import { adminCanAll } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";

export function useCatalogueAuditPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCanAll(user, ["admin.catalog.read"]);
  const [data, setData] = useState<CatalogueAuditPageView | null>(null);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] =
    useState<CatalogueAuditEntityType | "ALL">("ALL");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(async () => {
    if (isAuthLoading || !canRead) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(
        await applicationsApi.getGlobalAudit({
          page,
          limit: 20,
          ...(entityType !== "ALL" ? { entityType } : {}),
          ...(action.trim() ? { action: action.trim() } : {}),
        }),
      );
    } catch (requestError) {
      setData(null);
      setError(normalizeApiError(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [action, canRead, entityType, isAuthLoading, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return {
    isAuthLoading,
    canRead,
    data,
    page,
    setPage,
    entityType,
    setEntityType,
    action,
    setAction,
    isLoading,
    error,
    load,
  };
}
