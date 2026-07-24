"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export type DetailTabKey = "details" | "tenants" | "history";

export function useDatabaseServerDetail(id: string) {
  const router = useRouter();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<DetailTabKey>("details");
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Complete Editable Server Record (matching UpdateDatabaseServerDto)
  const [server, setServer] = useState({
    id,
    name: "DB-PRIMARY-EG-01",
    driver: "postgres",
    host: "db-primary-eg-01.internal",
    port: 5432,
    maintenanceDatabase: "postgres",
    sslMode: "require",
    sslRejectUnauthorized: true,
    sslCa: "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAL0...\n-----END CERTIFICATE-----",
    sslCert: "",
    sslKey: "",
    removeSslConfig: false,
    status: "ACTIVE" as "ACTIVE" | "DRAINING" | "OFFLINE" | "DELETED",
    currentTenants: 45,
    maxTenants: 50,
    utilization: 90,
    countryIsoCode: "EG",
    countryName: "مصر (Egypt)",
    region: "Middle East",
    isPlacementTarget: true,
    createdAt: "2026-06-15 10:00:00",
    updatedAt: "2026-07-20 14:30:00",

    // Primary Credentials
    username: "postgres_admin",
    password: "••••••••••••",

    // Runtime App Credentials
    coreAppUser: "core_runtime_user",
    coreAppPass: "••••••••••••",
    crmAppUser: "crm_runtime_user",
    crmAppPass: "••••••••••••",
    tradeAppUser: "trade_runtime_user",
    tradeAppPass: "••••••••••••",
    workerAppUser: "worker_runtime_user",
    workerAppPass: "••••••••••••",

    // Provisioning & Backup Credentials
    provisioningUser: "prov_admin_user",
    provisioningPass: "••••••••••••",
    removeProvisioningCredentials: false,
    backupUser: "backup_dump_user",
    backupPass: "••••••••••••",
    removeBackupCredentials: false,

    // Pool & Timeouts
    poolMin: 5,
    poolMax: 100,
    connectTimeoutMs: 10000,
    statementTimeoutMs: 30000,
    idleTimeoutMs: 30000,
  });

  // Mock Hosted Tenants List
  const placedTenants = [
    {
      id: "ten-1",
      name: "Acme Retail LLC",
      code: "ACME-EG",
      plan: "Enterprise Pro",
      status: "ACTIVE",
      joinedAt: "2026-06-20",
    },
    {
      id: "ten-2",
      name: "Delta Food Industries",
      code: "DELTA-EG",
      plan: "Starter Standard",
      status: "ACTIVE",
      joinedAt: "2026-07-01",
    },
    {
      id: "ten-3",
      name: "Al-Baraka Logistics",
      code: "BARAKA-EG",
      plan: "Business Growth",
      status: "PROVISIONING",
      joinedAt: "2026-07-21",
    },
  ];

  // Mock Audit Log History
  const auditLogs = [
    {
      id: "log-1",
      action: "LIFECYCLE",
      user: "منى علي (Mona Ali)",
      timestamp: "2026-07-20 14:30:15",
      changes: [
        { field: "status", oldValue: "DRAINING", newValue: "ACTIVE" },
        { field: "isPlacementTarget", oldValue: "false", newValue: "true" },
      ],
    },
    {
      id: "log-2",
      action: "UPDATE",
      user: "أحمد صابر (Ahmed Saber)",
      timestamp: "2026-07-01 09:12:00",
      changes: [{ field: "maxTenants", oldValue: "40", newValue: "50" }],
    },
  ];

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSubmitting(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleActivate = () => {
    setServer((prev) => ({ ...prev, status: "ACTIVE", isPlacementTarget: true }));
  };

  const handleDrain = () => {
    setServer((prev) => ({ ...prev, status: "DRAINING", isPlacementTarget: false }));
  };

  const handleOffline = () => {
    setServer((prev) => ({ ...prev, status: "OFFLINE", isPlacementTarget: false }));
  };

  const handleDelete = () => {
    router.push("/database-servers");
  };

  return {
    t,
    server,
    setServer,
    activeTab,
    setActiveTab,
    placedTenants,
    auditLogs,
    isSubmitting,
    isSaved,
    handleUpdateSubmit,
    handleActivate,
    handleDrain,
    handleOffline,
    handleDelete,
    onBack: () => router.push("/database-servers"),
  };
}
