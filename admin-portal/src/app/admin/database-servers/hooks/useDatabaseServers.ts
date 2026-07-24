"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface DatabaseServerRow {
  id: string;
  name: string;
  driver: string;
  host: string;
  port: number;
  maintenanceDatabase: string;
  sslMode: string;
  status: "ACTIVE" | "DRAINING" | "OFFLINE" | "DELETED";
  currentTenants: number;
  maxTenants: number;
  utilization: number;
  countryIsoCode: string;
  countryName: string;
  region: string;
  isPlacementTarget: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useDatabaseServers() {
  const { t } = useI18n();

  // Filters & Pagination State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");

  // Drawers & Modals State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [auditServerId, setAuditServerId] = useState<string | null>(null);

  // Connectivity Test State inside Create Form
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);

  // Mock Database Servers Dataset (matching PaginatedResult<DatabaseServer>)
  const [servers, setServers] = useState<DatabaseServerRow[]>([
    {
      id: "019f0000-0001-7000-8000-000000000001",
      name: "DB-PRIMARY-EG-01",
      driver: "postgres",
      host: "db-primary-eg-01.internal",
      port: 5432,
      maintenanceDatabase: "postgres",
      sslMode: "require",
      status: "ACTIVE",
      currentTenants: 45,
      maxTenants: 50,
      utilization: 90,
      countryIsoCode: "EG",
      countryName: "مصر (Egypt)",
      region: "Middle East",
      isPlacementTarget: true,
      createdAt: "2026-06-15T10:00:00.000Z",
      updatedAt: "2026-07-20T14:30:00.000Z",
    },
    {
      id: "019f0000-0002-7000-8000-000000000002",
      name: "DB-PRIMARY-SA-01",
      driver: "postgres",
      host: "db-primary-sa-01.internal",
      port: 5432,
      maintenanceDatabase: "postgres",
      sslMode: "require",
      status: "ACTIVE",
      currentTenants: 28,
      maxTenants: 50,
      utilization: 56,
      countryIsoCode: "SA",
      countryName: "المملكة العربية السعودية (KSA)",
      region: "GCC",
      isPlacementTarget: true,
      createdAt: "2026-06-18T11:00:00.000Z",
      updatedAt: "2026-07-19T09:15:00.000Z",
    },
    {
      id: "019f0000-0003-7000-8000-000000000003",
      name: "DB-PRIMARY-UAE-01",
      driver: "postgres",
      host: "db-primary-uae-01.internal",
      port: 5432,
      maintenanceDatabase: "postgres",
      sslMode: "require",
      status: "ACTIVE",
      currentTenants: 12,
      maxTenants: 50,
      utilization: 24,
      countryIsoCode: "AE",
      countryName: "الإمارات (UAE)",
      region: "GCC",
      isPlacementTarget: true,
      createdAt: "2026-06-25T08:30:00.000Z",
      updatedAt: "2026-07-15T16:20:00.000Z",
    },
    {
      id: "019f0000-0004-7000-8000-000000000004",
      name: "DB-MAINTENANCE-EG-02",
      driver: "postgres",
      host: "db-maint-eg-02.internal",
      port: 5432,
      maintenanceDatabase: "postgres",
      sslMode: "disable",
      status: "DRAINING",
      currentTenants: 5,
      maxTenants: 50,
      utilization: 10,
      countryIsoCode: "EG",
      countryName: "مصر (Egypt)",
      region: "Middle East",
      isPlacementTarget: false,
      createdAt: "2026-05-10T14:00:00.000Z",
      updatedAt: "2026-07-22T10:00:00.000Z",
    },
  ]);

  // Derived Filtered List
  const filteredServers = servers.filter((srv) => {
    const matchesSearch =
      !search ||
      srv.name.toLowerCase().includes(search.toLowerCase()) ||
      srv.host.toLowerCase().includes(search.toLowerCase()) ||
      srv.countryName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || srv.status === statusFilter;
    const matchesCountry = countryFilter === "ALL" || srv.countryIsoCode === countryFilter;
    return matchesSearch && matchesStatus && matchesCountry;
  });

  // Summary Metrics
  const summaryMetrics = {
    totalServers: servers.length,
    activeServers: servers.filter((s) => s.status === "ACTIVE").length,
    drainingServers: servers.filter((s) => s.status === "DRAINING").length,
    totalTenantsPlaced: servers.reduce((sum, s) => sum + s.currentTenants, 0),
    maxCapacity: servers.reduce((sum, s) => sum + s.maxTenants, 0),
    platformUtilizationRatio: Math.round(
      (servers.reduce((sum, s) => sum + s.currentTenants, 0) /
        (servers.reduce((sum, s) => sum + s.maxTenants, 0) || 1)) *
        100
    ),
  };

  // Lifecycle Status Handlers (POST /admin/database-servers/:id/*)
  const handleActivate = (id: string) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "ACTIVE", isPlacementTarget: true } : s
      )
    );
  };

  const handleDrain = (id: string) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "DRAINING", isPlacementTarget: false } : s
      )
    );
  };

  const handleOffline = (id: string) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "OFFLINE", isPlacementTarget: false } : s
      )
    );
  };

  const handleDelete = (id: string) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
  };

  // Connectivity Check Handler (POST /admin/database-servers/check-connectivity)
  const handleCheckConnectivity = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsTestingConnection(false);
    setConnectionResult({
      connected: true,
      message: t.dbServers.connectionSuccess,
    });
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
    setLimit,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    isCreateOpen,
    setIsCreateOpen,
    auditServerId,
    setAuditServerId,
    isTestingConnection,
    connectionResult,
    servers: filteredServers,
    totalItems: filteredServers.length,
    summaryMetrics,
    handleActivate,
    handleDrain,
    handleOffline,
    handleDelete,
    handleCheckConnectivity,
  };
}
