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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [auditServerId, setAuditServerId] = useState<string | null>(null);

  // Destructive Action Modal States
  const [activeModalServer, setActiveModalServer] = useState<DatabaseServerRow | null>(null);
  const [modalActionType, setModalActionType] = useState<"drain" | "delete" | "activate" | null>(null);

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
      countryName: "مصر",
      region: "Middle East",
      isPlacementTarget: true,
      createdAt: "2026-06-15",
      updatedAt: "2026-07-20",
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
      countryName: "السعودية",
      region: "GCC",
      isPlacementTarget: true,
      createdAt: "2026-06-18",
      updatedAt: "2026-07-19",
    },
    {
      id: "019f0000-0003-7000-8000-000000000003",
      name: "DB-PRIMARY-AE-01",
      driver: "postgres",
      host: "db-primary-ae-01.internal",
      port: 5432,
      maintenanceDatabase: "postgres",
      sslMode: "require",
      status: "ACTIVE",
      currentTenants: 12,
      maxTenants: 50,
      utilization: 24,
      countryIsoCode: "AE",
      countryName: "الإمارات",
      region: "GCC",
      isPlacementTarget: true,
      createdAt: "2026-07-01",
      updatedAt: "2026-07-22",
    },
  ]);

  const filteredServers = servers.filter((srv) => {
    const matchesSearch =
      search === "" ||
      srv.name.toLowerCase().includes(search.toLowerCase()) ||
      srv.host.toLowerCase().includes(search.toLowerCase()) ||
      srv.countryName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || srv.status === statusFilter;
    const matchesCountry = countryFilter === "ALL" || srv.countryIsoCode === countryFilter;

    return matchesSearch && matchesStatus && matchesCountry;
  });

  const summaryMetrics = {
    totalServers: servers.length,
    activeServers: servers.filter((s) => s.status === "ACTIVE" && s.isPlacementTarget).length,
    drainingServers: servers.filter((s) => s.status === "DRAINING").length,
    offlineServers: servers.filter((s) => s.status === "OFFLINE").length,
    maxCapacity: servers.reduce((acc, s) => acc + s.maxTenants, 0),
    totalTenantsPlaced: servers.reduce((acc, s) => acc + s.currentTenants, 0),
    platformUtilizationRatio: Math.round(
      servers.reduce((acc, s) => acc + s.utilization, 0) / (servers.length || 1)
    ),
  };

  const openActivateModal = (srv: DatabaseServerRow) => {
    setActiveModalServer(srv);
    setModalActionType("activate");
  };

  const openDrainModal = (srv: DatabaseServerRow) => {
    setActiveModalServer(srv);
    setModalActionType("drain");
  };

  const openDeleteModal = (srv: DatabaseServerRow) => {
    setActiveModalServer(srv);
    setModalActionType("delete");
  };

  const confirmModalAction = () => {
    if (!activeModalServer || !modalActionType) return;
    if (modalActionType === "activate") {
      setServers((prev) =>
        prev.map((s) =>
          s.id === activeModalServer.id ? { ...s, status: "ACTIVE", isPlacementTarget: true } : s
        )
      );
    } else if (modalActionType === "drain") {
      setServers((prev) =>
        prev.map((s) =>
          s.id === activeModalServer.id ? { ...s, status: "DRAINING", isPlacementTarget: false } : s
        )
      );
    } else if (modalActionType === "delete") {
      setServers((prev) => prev.filter((s) => s.id !== activeModalServer.id));
    }
    setActiveModalServer(null);
    setModalActionType(null);
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
    servers: filteredServers,
    totalItems: filteredServers.length,
    summaryMetrics,
    activeModalServer,
    modalActionType,
    closeModal: () => { setActiveModalServer(null); setModalActionType(null); },
    confirmModalAction,
    openActivateModal,
    openDrainModal,
    openDeleteModal,
  };
}
