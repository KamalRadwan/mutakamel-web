import { useState, useCallback, useEffect, useRef } from "react";
import { applicationsApi } from "../api/applications.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
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
  const { t } = useI18n();
  const { getIdempotencyKey, resetKey } = useIdempotency();

  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listGeneration = useRef(0);
  const listController = useRef<AbortController | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearchState] = useState("");

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

  // `search` already arrives debounced from FilterBar (see useFilterBar);
  // resetting the page here keeps pagination in sync with a new search term.
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const fetchApplications = useCallback(async () => {
    const generation = ++listGeneration.current;
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    const isCurrent = () =>
      generation === listGeneration.current && !controller.signal.aborted;

    setIsLoading(true);
    setError(null);
    try {
      const query: ApplicationListQueryDto = {
        page,
        limit,
        ...(search ? { search } : {}),
        ...(typeFilter !== "ALL" ? { applicationType: typeFilter } : {}),
        ...(commercialFilter !== "ALL" ? { commercialMode: commercialFilter } : {}),
        ...(visibilityFilter !== "ALL" ? { catalogueVisibility: visibilityFilter } : {}),
        ...(lifecycleFilter !== "ALL" ? { lifecycleStatus: lifecycleFilter } : {}),
        ...(publicationFilter !== "ALL" ? { publicationStatus: publicationFilter } : {}),
        ...(deploymentFilter !== "ALL" ? { databaseDeployment: deploymentFilter } : {}),
      };
      const response = await applicationsApi.list(query, controller.signal);
      if (!isCurrent()) return;
      setApplications(response.data);
      if (response.meta) {
        setMeta(response.meta);
      }
    } catch (err) {
      if (!isCurrent()) return;
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      toast.error(t.applications.errorTitle, normalized.message);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [page, limit, search, typeFilter, commercialFilter, visibilityFilter, lifecycleFilter, publicationFilter, deploymentFilter, toast, t.applications.errorTitle]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void fetchApplications();
    });
    return () => {
      disposed = true;
      // Invalidate even if the transport completes despite cancellation.
      ++listGeneration.current;
      listController.current?.abort();
    };
  }, [fetchApplications]);

  const { createApplication, onboardApplication } =
    useApplicationRegistration(() => {
      void fetchApplications();
    });

  const updateDatabasePolicy = async (applicationKey: string, dto: UpdateApplicationDatabasePolicyDto) => {
    try {
      const key = getIdempotencyKey(dto);
      const receipt = await applicationsApi.updateDatabasePolicy(applicationKey, dto, key);
      toast.success(t.applications.successTitle, t.applications.databasePolicyUpdated);
      resetKey();
      fetchApplications();
      return receipt;
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast.error(t.applications.errorTitle, normalized.message);
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
