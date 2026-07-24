"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface TenantRecord {
  id: string;
  name: string;
  code: string;
  companyName: string;
  primaryFqdn: string;
  secondaryFqdnsCount: number;
  databaseServerName: string;
  databaseServerId: string;
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

  // Modal Action States
  const [activeModalTenant, setActiveModalTenant] = useState<TenantRecord | null>(null);
  const [modalActionType, setModalActionType] = useState<"activate" | "suspend" | "delete" | null>(null);

  // Mock Tenants Data
  const [tenants, setTenants] = useState<TenantRecord[]>([
    {
      id: "01950123-4567-7abc-8def-0123456789ab",
      name: "acme-retail",
      code: "ACME-EG",
      companyName: "Acme Retail LLC",
      primaryFqdn: "acme-retail.mutakamel.ai",
      secondaryFqdnsCount: 2,
      databaseServerName: "DB-PRIMARY-EG-01",
      databaseServerId: "srv-eg-01",
      countryName: "مصر",
      countryIsoCode: "EG",
      planName: "Enterprise Pro",
      seats: 50,
      status: "ACTIVE",
      ownerEmail: "mona.ali@acme.test",
      createdAt: "2026-06-20",
    },
    {
      id: "01950123-4567-7abc-8def-0123456789ac",
      name: "delta-food",
      code: "DELTA-EG",
      companyName: "Delta Food Industries",
      primaryFqdn: "delta-food.mutakamel.ai",
      secondaryFqdnsCount: 0,
      databaseServerName: "DB-PRIMARY-EG-01",
      databaseServerId: "srv-eg-01",
      countryName: "مصر",
      countryIsoCode: "EG",
      planName: "Starter Standard",
      seats: 10,
      status: "ACTIVE",
      ownerEmail: "contact@delta-food.test",
      createdAt: "2026-07-01",
    },
    {
      id: "01950123-4567-7abc-8def-0123456789ad",
      name: "baraka-logistics",
      code: "BARAKA-EG",
      companyName: "Al-Baraka Logistics",
      primaryFqdn: "baraka-logistics.mutakamel.ai",
      secondaryFqdnsCount: 1,
      databaseServerName: "DB-PRIMARY-EG-02",
      databaseServerId: "srv-eg-02",
      countryName: "مصر",
      countryIsoCode: "EG",
      planName: "Business Growth",
      seats: 25,
      status: "PROVISIONING",
      ownerEmail: "admin@baraka-logistics.test",
      createdAt: "2026-07-21",
    },
    {
      id: "01950123-4567-7abc-8def-0123456789ae",
      name: "gulf-traders",
      code: "GULF-SA",
      companyName: "Gulf Trading Co.",
      primaryFqdn: "gulf-traders.mutakamel.ai",
      secondaryFqdnsCount: 1,
      databaseServerName: "DB-PRIMARY-SA-01",
      databaseServerId: "srv-sa-01",
      countryName: "السعودية",
      countryIsoCode: "SA",
      planName: "Enterprise Pro",
      seats: 100,
      status: "SUSPENDED",
      ownerEmail: "sami@gulf-traders.sa",
      createdAt: "2026-05-10",
    },
  ]);

  const filteredTenants = tenants.filter((ten) => {
    const matchesSearch =
      search === "" ||
      ten.companyName.toLowerCase().includes(search.toLowerCase()) ||
      ten.name.toLowerCase().includes(search.toLowerCase()) ||
      ten.code.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || ten.status === statusFilter;
    const matchesServer = serverFilter === "ALL" || ten.databaseServerId === serverFilter;

    return matchesSearch && matchesStatus && matchesServer;
  });

  const summaryMetrics = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === "ACTIVE").length,
    provisioning: tenants.filter((t) => t.status === "PROVISIONING").length,
    suspended: tenants.filter((t) => t.status === "SUSPENDED").length,
    failed: tenants.filter((t) => t.status === "FAILED").length,
  };

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

  const confirmModalAction = () => {
    if (!activeModalTenant || !modalActionType) return;
    if (modalActionType === "activate") {
      setTenants((prev) =>
        prev.map((t) => (t.id === activeModalTenant.id ? { ...t, status: "ACTIVE" } : t))
      );
    } else if (modalActionType === "suspend") {
      setTenants((prev) =>
        prev.map((t) => (t.id === activeModalTenant.id ? { ...t, status: "SUSPENDED" } : t))
      );
    } else if (modalActionType === "delete") {
      setTenants((prev) => prev.filter((t) => t.id !== activeModalTenant.id));
    }
    setActiveModalTenant(null);
    setModalActionType(null);
  };

  const handleReprovision = (id: string) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "PROVISIONING" } : t))
    );
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
    tenants: filteredTenants,
    totalItems: filteredTenants.length,
    summaryMetrics,
    activeModalTenant,
    modalActionType,
    closeModal: () => { setActiveModalTenant(null); setModalActionType(null); },
    confirmModalAction,
    openActivateModal,
    openSuspendModal,
    openDeleteModal,
    handleReprovision,
  };
}
