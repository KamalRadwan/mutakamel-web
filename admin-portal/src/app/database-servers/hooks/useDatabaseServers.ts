"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { DatabaseServerListResponse, DatabaseServerRow, DatabaseServerStatus, DatabaseServerView } from "@/types/database-server";

export function useDatabaseServers() {
  const { t, lang } = useI18n();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [auditServerId, setAuditServerId] = useState<string | null>(null);

  // Destructive Action Modal States
  const [activeModalServer, setActiveModalServer] = useState<DatabaseServerRow | null>(null);
  const [modalActionType, setModalActionType] = useState<"drain" | "delete" | "activate" | "offline" | null>(null);

  const [servers, setServers] = useState<DatabaseServerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }>({
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Derived Summary Metrics - currently based on current page data as there is no specific metrics endpoint. 
  // In a real app, a separate endpoint might be needed for global metrics. 
  const summaryMetrics = {
    totalServers: meta.total, // Using total from meta
    activeServers: servers.filter((s) => s.status === "ACTIVE" && s.isPlacementTarget).length,
    drainingServers: servers.filter((s) => s.status === "DRAINING").length,
    offlineServers: servers.filter((s) => s.status === "OFFLINE").length,
    maxCapacity: servers.reduce((acc, s) => acc + s.maxTenants, 0),
    totalTenantsPlaced: servers.reduce((acc, s) => acc + s.currentTenants, 0),
    platformUtilizationRatio: servers.reduce((acc, s) => acc + s.maxTenants, 0) > 0
      ? servers.reduce((acc, s) => acc + s.currentTenants, 0) / servers.reduce((acc, s) => acc + s.maxTenants, 0)
      : 0,
  };

  // Debounce Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, countryFilter]);

  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter === "DELETED") {
        params.append("withDeleted", "true");
      } else if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (countryFilter !== "ALL") params.append("countryIsoCode", countryFilter);

      const response = await axiosClient.get<any>(`/api/admin/core/v1/database-servers?${params.toString()}`);
      
      const rawData = response.data;
      const itemsList: DatabaseServerView[] = rawData.items || rawData.data || (Array.isArray(rawData) ? rawData : []);

      const mappedServers: DatabaseServerRow[] = itemsList.map((srv: DatabaseServerView) => {
        const utilizationRatio = srv.maxTenants > 0 ? srv.currentTenants / srv.maxTenants : 0;
        const isPlacementTarget = srv.status === "ACTIVE" && srv.currentTenants < srv.maxTenants && srv.runtimePrincipalsReady && srv.hasProvisioningCredentials;
        return {
          ...srv,
          driver: "postgres",
          utilizationRatio,
          isPlacementTarget
        };
      });
      setServers(mappedServers);
      setMeta({
        total: rawData.total ?? rawData.meta?.total ?? itemsList.length,
        totalPages: rawData.totalPages ?? rawData.meta?.totalPages ?? 1,
        hasNext: Boolean(rawData.hasNext ?? rawData.meta?.hasNext),
        hasPrev: Boolean(rawData.hasPrev ?? rawData.meta?.hasPrev),
      });
    } catch (err: any) {
      console.warn("Failed to fetch database servers", err.message);
      setError(err.response?.data?.message || "Failed to fetch servers.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, countryFilter]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const openActivateModal = (srv: DatabaseServerRow) => {
    setActiveModalServer(srv);
    setModalActionType("activate");
  };

  const openDrainModal = (srv: DatabaseServerRow) => {
    setActiveModalServer(srv);
    setModalActionType("drain");
  };

  const openOfflineModal = (srv: DatabaseServerRow) => {
    setActiveModalServer(srv);
    setModalActionType("offline");
  };

  const openDeleteModal = (srv: DatabaseServerRow) => {
    setActiveModalServer(srv);
    setModalActionType("delete");
  };

  const confirmModalAction = async () => {
    if (!activeModalServer || !modalActionType) return;
    
    try {
      if (modalActionType === "activate") {
        await axiosClient.post(`/api/admin/core/v1/database-servers/${activeModalServer.id}/activate`, {});
      } else if (modalActionType === "drain") {
        await axiosClient.post(`/api/admin/core/v1/database-servers/${activeModalServer.id}/drain`, {});
      } else if (modalActionType === "offline") {
        await axiosClient.post(`/api/admin/core/v1/database-servers/${activeModalServer.id}/offline`, {});
      } else if (modalActionType === "delete") {
        await axiosClient.delete(`/api/admin/core/v1/database-servers/${activeModalServer.id}`);
      }
      
      // Refresh the list after successful action
      await fetchServers();
    } catch (err: any) {
      console.warn(`Failed to ${modalActionType} database server`, err.message);
      const errMsg = err.response?.data?.message || `فشل إجراء ${modalActionType}`;
      toast.error(
        lang === "ar" ? "تعذر إتمام الإجراء" : "Action Failed",
        errMsg
      );
    } finally {
      setActiveModalServer(null);
      setModalActionType(null);
    }
  };

  return {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    countryFilter,
    setCountryFilter,
    page,
    setPage,
    limit,
    isCreateOpen,
    setIsCreateOpen,
    auditServerId,
    setAuditServerId,
    servers,
    isLoading,
    error,
    meta,
    totalItems: meta.total,
    summaryMetrics,
    activeModalServer,
    modalActionType,
    closeModal: () => { setActiveModalServer(null); setModalActionType(null); },
    confirmModalAction,
    openActivateModal,
    openDrainModal,
    openOfflineModal,
    openDeleteModal,
    refresh: fetchServers,
  };
}
