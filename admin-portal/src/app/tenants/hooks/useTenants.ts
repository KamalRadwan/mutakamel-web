"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";

export interface TenantRecord {
  id: string;
  name: string;
  code: string;
  companyName: string;
  primaryFqdn: string;
  secondaryFqdnsCount: number;
  databaseServerName: string;
  databaseServerId: string;
  storageServerName?: string;
  storageServerId?: string;
  countryName: string;
  countryIsoCode: string;
  planName: string;
  seats: number;
  status: "ACTIVE" | "PROVISIONING" | "FAILED" | "SUSPENDED" | "DELETED";
  ownerEmail: string;
  createdAt: string;
}

export function useTenants() {
  const { t } = useI18n();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [serverFilter, setServerFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Modal Action States
  const [activeModalTenant, setActiveModalTenant] = useState<TenantRecord | null>(null);
  const [modalActionType, setModalActionType] = useState<"activate" | "suspend" | "delete" | null>(null);

  const [summaryMetrics, setSummaryMetrics] = useState({
    total: 0,
    active: 0,
    provisioning: 0,
    suspended: 0,
    failed: 0,
  });

  const fetchTenants = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (serverFilter !== "ALL") params.append("serverId", serverFilter);

      const res = await axiosClient.get(`/api/admin/core/v1/tenants?${params.toString()}`);
      if (res.data?.success) {
        setTenants(res.data.data || []);
        setTotalItems(res.data.meta?.totalItems || 0);
        
        if (res.data.meta?.summary) {
           setSummaryMetrics(res.data.meta.summary);
        }
      }
    } catch (err) {
      console.error("Failed to fetch tenants", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, serverFilter]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const openActivateModal = (ten: TenantRecord) => {
    setActiveModalTenant(ten);
    setModalActionType("activate");
  };

  const openSuspendModal = (ten: TenantRecord) => {
    setActiveModalTenant(ten);
    setModalActionType("suspend");
  };

  const openDeleteModal = (ten: TenantRecord) => {
    setActiveModalTenant(ten);
    setModalActionType("delete");
  };

  const confirmModalAction = async () => {
    if (!activeModalTenant || !modalActionType) return;
    try {
      if (modalActionType === "activate") {
        await axiosClient.post(`/api/admin/core/v1/tenants/${activeModalTenant.id}/activate`);
      } else if (modalActionType === "suspend") {
        await axiosClient.post(`/api/admin/core/v1/tenants/${activeModalTenant.id}/suspend`);
      } else if (modalActionType === "delete") {
        await axiosClient.delete(`/api/admin/core/v1/tenants/${activeModalTenant.id}`);
      }
      fetchTenants();
    } catch (err) {
      console.error("Failed to perform action", err);
    } finally {
      setActiveModalTenant(null);
      setModalActionType(null);
    }
  };

  const handleReprovision = async (id: string) => {
    try {
       await axiosClient.post(`/api/admin/core/v1/tenants/${id}/provisioning/reconcile`);
       fetchTenants();
    } catch(err) {
       console.error(err);
    }
  };

  return {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    serverFilter,
    setServerFilter,
    page,
    setPage,
    limit,
    tenants,
    totalItems,
    summaryMetrics,
    activeModalTenant,
    modalActionType,
    closeModal: () => { setActiveModalTenant(null); setModalActionType(null); },
    confirmModalAction,
    openActivateModal,
    openSuspendModal,
    openDeleteModal,
    handleReprovision,
    isLoading,
  };
}

