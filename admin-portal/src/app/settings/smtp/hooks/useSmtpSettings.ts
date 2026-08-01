"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { SuccessResponse } from "@/types/common";

import { useHasPermission } from "@/components/auth/RequirePermission";

export interface SmtpConfigState {
  fromAddress: string;
  fromName: string;
  senderDomain: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpProtocol: "smtp" | "smtps";
  smtpUsername: string;
  smtpPasswordConfigured: boolean;
  configured: boolean;
  revision?: number | null;
  updatedAt?: string | null;
}

export interface SmtpAuditChange {
  field: string;
  label: string;
  previousValue: any;
  newValue: any;
}

export interface SmtpAuditLog {
  id: string;
  action: "CONFIGURED" | "UPDATED" | "CONNECTION_VERIFIED";
  revision: number | null;
  actor: string;
  changes: SmtpAuditChange[];
  createdAt: string;
}

export function useSmtpSettings() {
  const { lang } = useI18n();
  const hasUpdatePermission = useHasPermission("admin.settings.update");

  const [config, setConfig] = useState<SmtpConfigState>({
    fromAddress: "",
    fromName: "",
    senderDomain: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: true,
    smtpProtocol: "smtps",
    smtpUsername: "",
    smtpPasswordConfigured: false,
    configured: false,
  });

  const [auditLogs, setAuditLogs] = useState<SmtpAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const [configRes, auditRes] = await Promise.all([
        axiosClient.get<SuccessResponse<any>>(`/api/admin/core/v1/system-settings/email`),
        axiosClient.get<SuccessResponse<SmtpAuditLog[]>>(`/api/admin/core/v1/system-settings/email/audit`),
      ]);

      if (configRes.data && configRes.data.success) {
        const data = configRes.data.data;
        setConfig({
          fromAddress: data.fromAddress || "",
          fromName: data.fromName || "",
          senderDomain: data.senderDomain || "",
          smtpHost: data.smtpHost || "",
          smtpPort: data.smtpPort || 587,
          smtpSecure: Boolean(data.smtpSecure),
          smtpProtocol: data.smtpProtocol || "smtp",
          smtpUsername: data.smtpUsername || "",
          smtpPasswordConfigured: Boolean(data.smtpPasswordConfigured),
          configured: Boolean(data.configured),
          revision: data.revision,
          updatedAt: data.updatedAt,
        });
      }

      if (auditRes.data && auditRes.data.success) {
        setAuditLogs(auditRes.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch SMTP settings or audit logs", err);
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleUpdate = (field: keyof SmtpConfigState, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const saveConfig = async (password?: string) => {
    setIsSaving(true);
    setErrorMessage(null);

    const payload: Record<string, any> = {
      fromAddress: config.fromAddress,
      fromName: config.fromName,
      senderDomain: config.senderDomain,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpProtocol: config.smtpProtocol,
      smtpUsername: config.smtpUsername,
    };

    if (password) {
      payload.smtpPassword = password;
    }

    try {
      const res = await axiosClient.patch<SuccessResponse<any>>(
        `/api/admin/core/v1/system-settings/email`,
        payload
      );

      const updated = res.data.data;
      setConfig((prev) => ({
        ...prev,
        smtpPasswordConfigured: Boolean(updated.smtpPasswordConfigured),
        revision: updated.revision,
        configured: Boolean(updated.configured),
      }));
      setLastSaved(new Date());
      fetchConfig();
    } catch (err: any) {
      let msg = "Failed to save SMTP configuration";
      if (err?.response?.data) {
        msg = err.response.data.message || err.response.data.title || err.response.data.detail || msg;
      }
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const verifyConnection = async () => {
    setIsVerifying(true);
    setVerifyStatus("idle");
    setErrorMessage(null);

    try {
      await axiosClient.post<SuccessResponse<any>>(
        `/api/admin/core/v1/system-settings/email/verify-connection`,
        undefined // Explicitly no body
      );

      setVerifyStatus("success");
      fetchConfig();
    } catch (err: any) {
      setVerifyStatus("error");
      let msg = "Connection verification failed";
      if (err?.response?.data) {
        msg = err.response.data.message || err.response.data.title || err.response.data.detail || msg;
      }
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    lang,
    config,
    auditLogs,
    isLoading,
    isSaving,
    lastSaved,
    errorMessage,
    handleUpdate,
    saveConfig,
    verifyConnection,
    isVerifying,
    verifyStatus,
    refetch: fetchConfig,
    hasUpdatePermission,
  };
}
