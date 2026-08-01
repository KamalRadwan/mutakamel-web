import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { 
  DatabaseServerView, 
  DatabaseServerHistoryView, 
  UpdateDatabaseServerDto,
  CheckDatabaseServerConnectivityDto,
  DatabaseServerConnectivityResult,
  DatabaseServerSslMode
} from "@/types/database-server";

export type DetailTabKey = "details" | "tenants" | "history";

export function useDatabaseServerDetail(id: string) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<DetailTabKey>("details");
  
  const [server, setServer] = useState<DatabaseServerView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Editable Form State
  const [formData, setFormDataState] = useState<any>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<DatabaseServerConnectivityResult | null>(null);
  const [requiresConnectionTest, setRequiresConnectionTest] = useState(false);
  const [isTestedAndConnected, setIsTestedAndConnected] = useState(true);

  const setFormData = (updated: any) => {
    setFormDataState(updated);
    
    // Any setting used for a connectivity probe invalidates an earlier probe.
    const hasConnectionChanges = Boolean(
      (server && (
        updated.host !== server.host ||
        Number(updated.port) !== server.port ||
        updated.maintenanceDatabase !== server.maintenanceDatabase ||
        updated.sslMode !== server.sslMode ||
        updated.sslRejectUnauthorized !== server.sslRejectUnauthorized ||
        Number(updated.connectTimeoutMs) !== server.connectTimeoutMs ||
        Number(updated.statementTimeoutMs) !== server.statementTimeoutMs ||
        Number(updated.idleTimeoutMs) !== server.idleTimeoutMs
      )) ||
      updated.username !== formData.username ||
      updated.password !== formData.password ||
      updated.coreAppUser !== formData.coreAppUser ||
      updated.coreAppPass !== formData.coreAppPass ||
      updated.crmAppUser !== formData.crmAppUser ||
      updated.crmAppPass !== formData.crmAppPass ||
      updated.tradeAppUser !== formData.tradeAppUser ||
      updated.tradeAppPass !== formData.tradeAppPass ||
      updated.workerAppUser !== formData.workerAppUser ||
      updated.workerAppPass !== formData.workerAppPass ||
      updated.provisioningUser !== formData.provisioningUser ||
      updated.provisioningPass !== formData.provisioningPass ||
      updated.backupUser !== formData.backupUser ||
      updated.backupPass !== formData.backupPass ||
      updated.sslCa !== formData.sslCa ||
      updated.sslCert !== formData.sslCert ||
      updated.sslKey !== formData.sslKey ||
      updated.sslPassphrase !== formData.sslPassphrase ||
      updated.removeSslConfig !== formData.removeSslConfig
    );

    if (hasConnectionChanges) {
      setRequiresConnectionTest(true);
      setIsTestedAndConnected(false);
    }
  };
  
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Hosted Tenants State
  const [placedTenants, setPlacedTenants] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsMeta, setTenantsMeta] = useState<any>(null);
  const [tenantsPage, setTenantsPage] = useState(1);
  const [tenantsError, setTenantsError] = useState<string | null>(null);

  // Audit History State
  const [auditLogs, setAuditLogs] = useState<DatabaseServerHistoryView[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Destructive Action Modal States
  const [modalActionType, setModalActionType] = useState<"drain" | "offline" | "delete" | "activate" | null>(null);

  const fetchServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const response = await axiosClient.get(`/api/admin/core/v1/database-servers/${id}`);
      const data: DatabaseServerView = response.data?.data || response.data;
      setServer(data);
      
      // Hydrate form data safely without triggering credential change detection
      setFormDataState({
        name: data.name,
        host: data.host,
        port: data.port,
        maintenanceDatabase: data.maintenanceDatabase,
        sslMode: data.sslMode,
        sslRejectUnauthorized: data.sslRejectUnauthorized,
        sslCa: "",
        sslCert: "",
        sslKey: "",
        sslPassphrase: "",
        removeSslConfig: false,
        maxTenants: data.maxTenants,
        countryIsoCode: data.countryIsoCode || "EG",
        
        // Blank secrets
        username: "",
        password: "",
        coreAppUser: "",
        coreAppPass: "",
        crmAppUser: "",
        crmAppPass: "",
        tradeAppUser: "",
        tradeAppPass: "",
        workerAppUser: "",
        workerAppPass: "",
        
        provisioningUser: "",
        provisioningPass: "",
        removeProvisioningCredentials: false,
        
        backupUser: "",
        backupPass: "",
        removeBackupCredentials: false,

        poolMin: data.poolMin,
        poolMax: data.poolMax,
        connectTimeoutMs: data.connectTimeoutMs,
        statementTimeoutMs: data.statementTimeoutMs,
        idleTimeoutMs: data.idleTimeoutMs,
      });

      setRequiresConnectionTest(false);
      setIsTestedAndConnected(true);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setIsForbidden(true);
      } else if (err.response?.status === 404) {
        setError("السيرفر غير موجود أو تم حذفه (Server not found)");
      } else {
        setError(err.response?.data?.message || "فشل تحميل تفاصيل السيرفر");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  // Fetch Tenants when tab active
  useEffect(() => {
    if (activeTab === "tenants") {
      const fetchTenants = async () => {
        setTenantsLoading(true);
        setTenantsError(null);
        try {
          const response = await axiosClient.get(`/api/admin/core/v1/tenants?databaseServerId=${id}&page=${tenantsPage}&limit=20`);
          const items = response.data?.items || response.data?.data || (Array.isArray(response.data) ? response.data : []);
          setPlacedTenants(items);
          setTenantsMeta(response.data?.meta || { total: items.length });
        } catch (err: any) {
          if (err.response?.status === 403) {
            setTenantsError("ليس لديك صلاحية لعرض المستأجرين");
          } else {
            setTenantsError("فشل تحميل المستأجرين");
          }
        } finally {
          setTenantsLoading(false);
        }
      };
      fetchTenants();
    }
  }, [activeTab, id, tenantsPage]);

  // Fetch History when tab active
  useEffect(() => {
    if (activeTab === "history") {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        setHistoryError(null);
        try {
          const response = await axiosClient.get(`/api/admin/core/v1/database-servers/${id}/history?limit=50`);
          const items = response.data?.items || response.data?.data || (Array.isArray(response.data) ? response.data : []);
          setAuditLogs(items);
        } catch (err: any) {
          if (err.response?.status === 403) {
            setHistoryError("ليس لديك صلاحية لعرض السجل");
          } else {
            setHistoryError("فشل تحميل سجل التدقيق");
          }
        } finally {
          setHistoryLoading(false);
        }
      };
      fetchHistory();
    }
  }, [activeTab, id]);

  const buildSslConfig = () => {
    if (formData.sslMode === "disable") return undefined;
    if (!formData.sslCa && !formData.sslCert && !formData.sslKey) return undefined;
    return {
      ca: formData.sslCa || undefined,
      cert: formData.sslCert || undefined,
      key: formData.sslKey || undefined,
      passphrase: formData.sslPassphrase || undefined,
    };
  };

  const buildCredentialGroups = (requirePrimaryCredentials: boolean) => {
    const primaryUsername = (formData.username || "").trim();
    const primaryPassword = formData.password || "";
    const hasPrimaryUsername = Boolean(primaryUsername);
    const hasPrimaryPassword = Boolean(primaryPassword);
    if (hasPrimaryUsername !== hasPrimaryPassword) {
      return {
        ok: false as const,
        error: "أكمل اسم المستخدم وكلمة المرور لحساب قاعدة البيانات الرئيسي، أو اتركهما فارغين.",
      };
    }
    if (requirePrimaryCredentials && (!hasPrimaryUsername || !hasPrimaryPassword)) {
      return {
        ok: false as const,
        error: "أعد إدخال حساب قاعدة البيانات الرئيسي قبل اختبار تغييرات الاتصال.",
      };
    }

    const coreAppUser = (formData.coreAppUser || "").trim();
    const crmAppUser = (formData.crmAppUser || "").trim();
    const tradeAppUser = (formData.tradeAppUser || "").trim();
    const workerAppUser = (formData.workerAppUser || "").trim();
    const coreAppPass = formData.coreAppPass || "";
    const crmAppPass = formData.crmAppPass || "";
    const tradeAppPass = formData.tradeAppPass || "";
    const workerAppPass = formData.workerAppPass || "";
    const hasAnyRuntime = Boolean(
      coreAppUser || coreAppPass || crmAppUser || crmAppPass ||
      tradeAppUser || tradeAppPass || workerAppUser || workerAppPass,
    );
    const hasCompleteRuntime = Boolean(
      coreAppUser && coreAppPass && crmAppUser && crmAppPass &&
      tradeAppUser && tradeAppPass && workerAppUser && workerAppPass,
    );
    if (hasAnyRuntime && !hasCompleteRuntime) {
      return {
        ok: false as const,
        error: "أكمل حسابات التشغيل الأربعة (Core وCRM وTrade وWorker)، أو اتركها جميعًا فارغة.",
      };
    }

    const provisioningUsername = (formData.provisioningUser || "").trim();
    const provisioningPassword = formData.provisioningPass || "";
    if (Boolean(provisioningUsername) !== Boolean(provisioningPassword)) {
      return {
        ok: false as const,
        error: "أكمل اسم المستخدم وكلمة المرور لحساب Provisioning، أو اتركهما فارغين.",
      };
    }

    const backupUsername = (formData.backupUser || "").trim();
    const backupPassword = formData.backupPass || "";
    if (Boolean(backupUsername) !== Boolean(backupPassword)) {
      return {
        ok: false as const,
        error: "أكمل اسم المستخدم وكلمة المرور لحساب Backup، أو اتركهما فارغين.",
      };
    }

    return {
      ok: true as const,
      credentials: hasPrimaryUsername
        ? { username: primaryUsername, password: primaryPassword }
        : undefined,
      runtimeCredentials: hasCompleteRuntime
        ? {
            coreApp: { username: coreAppUser, password: coreAppPass },
            crmApp: { username: crmAppUser, password: crmAppPass },
            tradeApp: { username: tradeAppUser, password: tradeAppPass },
            workerApp: { username: workerAppUser, password: workerAppPass },
          }
        : undefined,
      provisioningCredentials: provisioningUsername
        ? { username: provisioningUsername, password: provisioningPassword }
        : undefined,
      backupCredentials: backupUsername
        ? { username: backupUsername, password: backupPassword }
        : undefined,
    };
  };

  const handleTestConnection = async () => {
    const credentialGroups = buildCredentialGroups(true);
    if (!credentialGroups.ok) {
      setIsTestedAndConnected(false);
      setTestResult({ connected: false, message: credentialGroups.error });
      setError(credentialGroups.error);
      toast.error(lang === "ar" ? "بيانات اعتماد ناقصة" : "Incomplete credentials", credentialGroups.error);
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const payload: CheckDatabaseServerConnectivityDto = {
        host: (formData.host || server?.host || "").trim(),
        port: Number(formData.port || server?.port || 5432),
        credentials: credentialGroups.credentials,
        sslMode: formData.sslMode,
        sslRejectUnauthorized: formData.sslRejectUnauthorized,
        sslConfig: buildSslConfig(),
        maintenanceDatabase: (formData.maintenanceDatabase || "").trim() || undefined,
        connectTimeoutMs: Number(formData.connectTimeoutMs),
        statementTimeoutMs: Number(formData.statementTimeoutMs),
        idleTimeoutMs: Number(formData.idleTimeoutMs),
      };
      if (credentialGroups.runtimeCredentials) {
        payload.runtimeCredentials = credentialGroups.runtimeCredentials;
      }
      if (credentialGroups.provisioningCredentials) {
        payload.provisioningCredentials = credentialGroups.provisioningCredentials;
      }
      if (credentialGroups.backupCredentials) {
        payload.backupCredentials = credentialGroups.backupCredentials;
      }

      const response = await axiosClient.post("/api/admin/core/v1/database-servers/check-connectivity", payload);
      const data = response.data?.data || response.data;

      setTestResult({
        connected: data.connected,
        message: data.message,
        checks: data.checks,
      });

      if (data.connected) {
        setIsTestedAndConnected(true);
        toast.success(
          lang === "ar" ? "نجح الاتصال" : "Connection Successful",
          data.message || t.dbServers.connectionSuccess
        );
      } else {
        setIsTestedAndConnected(false);
        toast.error(
          lang === "ar" ? "فشل الاتصال" : "Connection Failed",
          data.message || t.dbServers.connectionFailed
        );
      }
    } catch (err: any) {
      console.warn("Connectivity test failed", err.message);
      const errMsg = err.response?.data?.message || (lang === "ar" ? "فشل التحقق من الاتصال" : "Connection test failed");
      setIsTestedAndConnected(false);
      setTestResult({ connected: false, message: errMsg });
      toast.error(lang === "ar" ? "فشل الاتصال" : "Connection Failed", errMsg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const credentialGroups = buildCredentialGroups(false);
      if (!credentialGroups.ok) {
        setError(credentialGroups.error);
        setIsTestedAndConnected(false);
        return;
      }

      const payload: UpdateDatabaseServerDto = {};

      // Add only dirty/changed fields (simplified check here, ideally deep compare with original `server`)
      if (formData.name !== server.name) payload.name = formData.name.trim();
      if (formData.host !== server.host) payload.host = formData.host.trim();
      if (formData.port !== server.port) payload.port = Number(formData.port);
      if (formData.maxTenants !== server.maxTenants) payload.maxTenants = Number(formData.maxTenants);
      if (formData.countryIsoCode !== server.countryIsoCode) payload.countryIsoCode = formData.countryIsoCode;
      if (formData.maintenanceDatabase !== server.maintenanceDatabase) payload.maintenanceDatabase = formData.maintenanceDatabase.trim() || undefined;

      if (formData.poolMin !== server.poolMin) payload.poolMin = Number(formData.poolMin);
      if (formData.poolMax !== server.poolMax) payload.poolMax = Number(formData.poolMax);
      if (formData.connectTimeoutMs !== server.connectTimeoutMs) payload.connectTimeoutMs = Number(formData.connectTimeoutMs);
      if (formData.statementTimeoutMs !== server.statementTimeoutMs) payload.statementTimeoutMs = Number(formData.statementTimeoutMs);
      if (formData.idleTimeoutMs !== server.idleTimeoutMs) payload.idleTimeoutMs = Number(formData.idleTimeoutMs);

      if (credentialGroups.credentials) {
        payload.credentials = credentialGroups.credentials;
      }
      if (credentialGroups.runtimeCredentials) {
        payload.runtimeCredentials = credentialGroups.runtimeCredentials;
      }

      // XOR Logic for Provisioning, Backup, SSL
      if (formData.removeProvisioningCredentials) {
        payload.removeProvisioningCredentials = true;
      } else if (credentialGroups.provisioningCredentials) {
        payload.provisioningCredentials = credentialGroups.provisioningCredentials;
      }

      if (formData.removeBackupCredentials) {
        payload.removeBackupCredentials = true;
      } else if (credentialGroups.backupCredentials) {
        payload.backupCredentials = credentialGroups.backupCredentials;
      }

      if (formData.removeSslConfig) {
        payload.removeSslConfig = true;
      } else if (formData.sslMode !== "disable" && (formData.sslCa || formData.sslCert || formData.sslKey)) {
        payload.sslMode = formData.sslMode;
        payload.sslRejectUnauthorized = formData.sslRejectUnauthorized;
        payload.sslConfig = {
          ca: formData.sslCa || undefined,
          cert: formData.sslCert || undefined,
          key: formData.sslKey || undefined,
          passphrase: formData.sslPassphrase || undefined,
        };
      } else if (formData.sslMode !== server.sslMode || formData.sslRejectUnauthorized !== server.sslRejectUnauthorized) {
        payload.sslMode = formData.sslMode;
        payload.sslRejectUnauthorized = formData.sslRejectUnauthorized;
      }

      // Check if payload is empty except for remove flags
      if (Object.keys(payload).length === 0) {
        setIsSubmitting(false);
        return; // Nothing to update
      }

      await axiosClient.patch(`/api/admin/core/v1/database-servers/${id}`, payload);
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      await fetchServer(); // Refresh data
    } catch (err: any) {
      console.warn("Update failed", err.message);
      if (err.response?.data?.errorCode === "DB_SERVER_CONNECTION_CHANGED_RETRY") {
        setError("تغير الاتصال أثناء التحقق. يرجى إعادة المحاولة. (Connection changed concurrently)");
        await fetchServer(); // Reload latest
      } else {
        setError(err.response?.data?.message || "حدث خطأ أثناء التحديث");
        if (err.response?.data?.details) {
          setFieldErrors(err.response.data.details);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActivateModal = () => setModalActionType("activate");
  const openDrainModal = () => setModalActionType("drain");
  const openOfflineModal = () => setModalActionType("offline");
  const openDeleteModal = () => setModalActionType("delete");
  const closeModal = () => setModalActionType(null);

  const confirmModalAction = async () => {
    if (!modalActionType || !server) return;
    
    try {
      if (modalActionType === "activate") {
        await axiosClient.post(`/api/admin/core/v1/database-servers/${id}/activate`, {});
        await fetchServer();
      } else if (modalActionType === "drain") {
        await axiosClient.post(`/api/admin/core/v1/database-servers/${id}/drain`, {});
        await fetchServer();
      } else if (modalActionType === "offline") {
        await axiosClient.post(`/api/admin/core/v1/database-servers/${id}/offline`, {});
        await fetchServer();
      } else if (modalActionType === "delete") {
        await axiosClient.delete(`/api/admin/core/v1/database-servers/${id}`);
        router.push("/database-servers");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${modalActionType} server`);
    } finally {
      setModalActionType(null);
    }
  };

  return {
    t,
    server,
    formData,
    setFormData,
    isLoading,
    error,
    isForbidden,
    fieldErrors,
    activeTab,
    setActiveTab,
    placedTenants,
    tenantsLoading,
    tenantsError,
    tenantsMeta,
    tenantsPage,
    setTenantsPage,
    auditLogs,
    historyLoading,
    historyError,
    isTesting,
    testResult,
    requiresConnectionTest,
    isTestedAndConnected,
    handleTestConnection,
    isSubmitting,
    isSaved,
    handleUpdateSubmit,
    modalActionType,
    openActivateModal,
    openDrainModal,
    openOfflineModal,
    openDeleteModal,
    closeModal,
    confirmModalAction,
    onBack: () => router.push("/database-servers"),
  };
}
