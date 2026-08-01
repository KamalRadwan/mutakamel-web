"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { 
  CreateDatabaseServerDto, 
  CheckDatabaseServerConnectivityDto, 
  DatabaseServerConnectivityResult,
  DatabaseServerSslMode 
} from "@/types/database-server";

export function useRegisterDatabaseServer() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: "",
    driver: "postgres" as const,
    host: "",
    port: 5432,
    maxTenants: 50,
    countryIsoCode: "EG",
    countryName: "مصر (Egypt)",
    maintenanceDatabase: "postgres",

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
    backupUser: "",
    backupPass: "",

    sslMode: "disable" as DatabaseServerSslMode,
    sslRejectUnauthorized: true,
    sslCa: "",
    sslCert: "",
    sslKey: "",
    sslPassphrase: "",

    poolMin: 0,
    poolMax: 50,
    connectTimeoutMs: 10000,
    statementTimeoutMs: 30000,
    idleTimeoutMs: 30000,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<DatabaseServerConnectivityResult | null>(null);
  const [isTestedAndConnected, setIsTestedAndConnected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const updateFormData = (updated: typeof formData) => {
    setFormData(updated);
    
    // The preflight covers all connection and credential fields submitted by
    // this form, so a successful result is invalid after any of them changes.
    const hasConnectionChanges =
      updated.host !== formData.host ||
      updated.port !== formData.port ||
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
      updated.sslMode !== formData.sslMode ||
      updated.sslRejectUnauthorized !== formData.sslRejectUnauthorized ||
      updated.sslCa !== formData.sslCa ||
      updated.sslCert !== formData.sslCert ||
      updated.sslKey !== formData.sslKey ||
      updated.sslPassphrase !== formData.sslPassphrase ||
      updated.maintenanceDatabase !== formData.maintenanceDatabase ||
      updated.connectTimeoutMs !== formData.connectTimeoutMs ||
      updated.statementTimeoutMs !== formData.statementTimeoutMs ||
      updated.idleTimeoutMs !== formData.idleTimeoutMs;

    if (hasConnectionChanges) {
      setIsTestedAndConnected(false);
    }
  };

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

  const buildCredentialGroups = () => {
    const primaryUsername = formData.username.trim();
    if (!primaryUsername || !formData.password) {
      return {
        ok: false as const,
        error: "أدخل اسم المستخدم وكلمة المرور لحساب قاعدة البيانات الرئيسي.",
      };
    }

    const hasAnyRuntime = Boolean(
      formData.coreAppUser.trim() || formData.coreAppPass ||
      formData.crmAppUser.trim() || formData.crmAppPass ||
      formData.tradeAppUser.trim() || formData.tradeAppPass ||
      formData.workerAppUser.trim() || formData.workerAppPass,
    );
    const hasCompleteRuntime = Boolean(
      formData.coreAppUser.trim() && formData.coreAppPass &&
      formData.crmAppUser.trim() && formData.crmAppPass &&
      formData.tradeAppUser.trim() && formData.tradeAppPass &&
      formData.workerAppUser.trim() && formData.workerAppPass,
    );
    if (hasAnyRuntime && !hasCompleteRuntime) {
      return {
        ok: false as const,
        error: "أكمل حسابات التشغيل الأربعة (Core وCRM وTrade وWorker)، أو اتركها جميعًا فارغة.",
      };
    }

    const hasProvisioningUsername = Boolean(formData.provisioningUser.trim());
    const hasProvisioningPassword = Boolean(formData.provisioningPass);
    if (hasProvisioningUsername !== hasProvisioningPassword) {
      return {
        ok: false as const,
        error: "أكمل اسم المستخدم وكلمة المرور لحساب Provisioning، أو اتركهما فارغين.",
      };
    }

    const hasBackupUsername = Boolean(formData.backupUser.trim());
    const hasBackupPassword = Boolean(formData.backupPass);
    if (hasBackupUsername !== hasBackupPassword) {
      return {
        ok: false as const,
        error: "أكمل اسم المستخدم وكلمة المرور لحساب Backup، أو اتركهما فارغين.",
      };
    }

    return {
      ok: true as const,
      credentials: {
        username: primaryUsername,
        password: formData.password,
      },
      runtimeCredentials: hasCompleteRuntime
        ? {
            coreApp: { username: formData.coreAppUser.trim(), password: formData.coreAppPass },
            crmApp: { username: formData.crmAppUser.trim(), password: formData.crmAppPass },
            tradeApp: { username: formData.tradeAppUser.trim(), password: formData.tradeAppPass },
            workerApp: { username: formData.workerAppUser.trim(), password: formData.workerAppPass },
          }
        : undefined,
      provisioningCredentials: hasProvisioningUsername
        ? { username: formData.provisioningUser.trim(), password: formData.provisioningPass }
        : undefined,
      backupCredentials: hasBackupUsername
        ? { username: formData.backupUser.trim(), password: formData.backupPass }
        : undefined,
    };
  };

  const handleTestConnection = async () => {
    const credentialGroups = buildCredentialGroups();
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
        host: formData.host.trim(),
        port: Number(formData.port),
        credentials: credentialGroups.credentials,
        sslMode: formData.sslMode,
        sslRejectUnauthorized: formData.sslRejectUnauthorized,
        sslConfig: buildSslConfig(),
        maintenanceDatabase: formData.maintenanceDatabase.trim() || undefined,
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
      const errMsg = err.response?.data?.message || (lang === "ar" ? "فشل التحقق من الاتصال بسبب خطأ في المدخلات" : "Connection test failed due to input error");
      setIsTestedAndConnected(false);
      setTestResult({
        connected: false,
        message: errMsg,
      });
      toast.error(
        lang === "ar" ? "فشل الاتصال" : "Connection Failed",
        errMsg
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const credentialGroups = buildCredentialGroups();
      if (!credentialGroups.ok) {
        setError(credentialGroups.error);
        setIsTestedAndConnected(false);
        return;
      }

      const payload: CreateDatabaseServerDto = {
        name: formData.name.trim(),
        host: formData.host.trim(),
        port: Number(formData.port),
        maxTenants: Number(formData.maxTenants),
        countryIsoCode: formData.countryIsoCode,
        
        credentials: credentialGroups.credentials,
        
        sslMode: formData.sslMode,
        sslRejectUnauthorized: formData.sslRejectUnauthorized,
        sslConfig: buildSslConfig(),
        maintenanceDatabase: formData.maintenanceDatabase.trim() || undefined,
        
        poolMin: Number(formData.poolMin),
        poolMax: Number(formData.poolMax),
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

      await axiosClient.post("/api/admin/core/v1/database-servers", payload);
      
      router.push("/database-servers");
    } catch (err: any) {
      console.warn("Create server failed", err.message);
      const res = err.response?.data;
      if (res) {
        setError(res.message);
        if (res.details) {
          setFieldErrors(res.details);
        }
      } else {
        setError("حدث خطأ غير معروف");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    formData,
    setFormData: updateFormData,
    isTesting,
    testResult,
    isTestedAndConnected,
    isSubmitting,
    error,
    fieldErrors,
    handleTestConnection,
    handleSubmit,
    onCancel: () => router.push("/database-servers"),
  };
}
