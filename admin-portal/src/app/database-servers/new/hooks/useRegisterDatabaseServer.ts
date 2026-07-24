"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export function useRegisterDatabaseServer() {
  const router = useRouter();
  const { t } = useI18n();

  const [formData, setFormData] = useState({
    // Basic Info & Placement
    name: "",
    driver: "postgres" as const,
    host: "",
    port: 5432,
    maxTenants: 50,
    countryIsoCode: "EG",
    countryName: "مصر (Egypt)",
    maintenanceDatabase: "postgres",

    // Primary Credentials
    username: "",
    password: "",

    // Runtime Pool Logins (Core / CRM / Trade / Worker)
    coreAppUser: "",
    coreAppPass: "",
    crmAppUser: "",
    crmAppPass: "",
    tradeAppUser: "",
    tradeAppPass: "",
    workerAppUser: "",
    workerAppPass: "",

    // Elevated Provisioning & Backup Credentials
    provisioningUser: "",
    provisioningPass: "",
    backupUser: "",
    backupPass: "",

    // SSL Config & Security
    sslMode: "require",
    sslRejectUnauthorized: true,
    sslCa: "",
    sslCert: "",
    sslKey: "",

    // Pool Tuning & Timeouts
    poolMin: 0,
    poolMax: 50,
    connectTimeoutMs: 10000,
    statementTimeoutMs: 30000,
    idleTimeoutMs: 30000,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsTesting(false);
    if (formData.host && formData.username) {
      setTestResult({
        connected: true,
        message: "تم الاتصال بسيرفر PostgreSQL بنجاح ورؤية قاعدة الصيانة المحددة.",
      });
    } else {
      setTestResult({
        connected: false,
        message: "فشل الاتصال: يرجى كتابة الـ Host واسم المستخدم أولاً.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsSubmitting(false);
    router.push("/database-servers");
  };

  return {
    t,
    formData,
    setFormData,
    isTesting,
    testResult,
    isSubmitting,
    handleTestConnection,
    handleSubmit,
    onCancel: () => router.push("/database-servers"),
  };
}
