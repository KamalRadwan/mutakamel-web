import { useState, useCallback, useEffect } from "react";
import { applicationsApi } from "../api/applications.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useApplicationRegistration } from "./useApplicationRegistration";
import {
  ApplicationListQueryDto,
  ApplicationView,
  UpdateApplicationDatabasePolicyDto,
  ApplicationType,
  ApplicationCommercialMode,
  ApplicationCatalogueVisibility,
  ApplicationLifecycleStatus,
  ApplicationDatabaseDeployment,
  ApplicationPublicationStatus,
} from "../types";

export function useApplications() {
  const toast = useToast();
  const { getIdempotencyKey, resetKey } = useIdempotency();

  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState<ApplicationType | "ALL">("ALL");
  const [commercialFilter, setCommercialFilter] = useState<ApplicationCommercialMode | "ALL">("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<ApplicationCatalogueVisibility | "ALL">("ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState<ApplicationLifecycleStatus | "ALL">("ALL");
  const [publicationFilter, setPublicationFilter] = useState<ApplicationPublicationStatus | "ALL">("ALL");
  const [deploymentFilter, setDeploymentFilter] = useState<ApplicationDatabaseDeployment | "ALL">("ALL");

  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query: ApplicationListQueryDto = {
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(typeFilter !== "ALL" ? { applicationType: typeFilter } : {}),
        ...(commercialFilter !== "ALL" ? { commercialMode: commercialFilter } : {}),
        ...(visibilityFilter !== "ALL" ? { catalogueVisibility: visibilityFilter } : {}),
        ...(lifecycleFilter !== "ALL" ? { lifecycleStatus: lifecycleFilter } : {}),
        ...(publicationFilter !== "ALL" ? { publicationStatus: publicationFilter } : {}),
        ...(deploymentFilter !== "ALL" ? { databaseDeployment: deploymentFilter } : {}),
      };
      const response = await applicationsApi.list(query);
      setApplications(response.data);
      if (response.meta) {
        setMeta(response.meta);
      }
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      toast.error("Error", normalized.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, typeFilter, commercialFilter, visibilityFilter, lifecycleFilter, publicationFilter, deploymentFilter, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchApplications();
    });
  }, [fetchApplications]);

  const { createApplication, onboardApplication } =
    useApplicationRegistration(() => {
      void fetchApplications();
    });

  const updateDatabasePolicy = async (applicationKey: string, dto: UpdateApplicationDatabasePolicyDto) => {
    try {
      const key = getIdempotencyKey(dto);
      const receipt = await applicationsApi.updateDatabasePolicy(applicationKey, dto, key);
      toast.success("Success", "Database policy updated.");
      resetKey();
      fetchApplications();
      return receipt;
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast.error("Error", normalized.message);
      throw normalized;
    }
  };

  return {
    applications,
    isLoading,
    error,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    commercialFilter,
    setCommercialFilter,
    visibilityFilter,
    setVisibilityFilter,
    lifecycleFilter,
    setLifecycleFilter,
    publicationFilter,
    setPublicationFilter,
    deploymentFilter,
    setDeploymentFilter,
    meta,
    createApplication,
    onboardApplication,
    updateDatabasePolicy,
    refresh: fetchApplications,
  };
}
