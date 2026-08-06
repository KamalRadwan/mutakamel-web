"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreateDatabaseServerDto,
  CheckDatabaseServerConnectivityDto,
  DatabaseServerConnectivityResult,
  DatabaseServerSslMode,
} from "../types";
import { useDatabaseServers } from "../hooks/useDatabaseServers";
import { DatabaseSslConfigurationFields } from "./DatabaseSslConfigurationFields";
import {
  createDatabaseServerInitialValues,
  credentialCheckLabel,
  DATABASE_ENGINE_REQUIREMENT,
  DATABASE_SERVER_CREATE_CONSTRAINTS,
  DATABASE_SECURITY_ADMIN_USERNAME_PATTERN,
  DATABASE_SECURITY_ADMIN_POSTURE,
  isDatabaseSecurityAdminStepValid,
  isDatabaseServerConnectionStepValid,
} from "../lib/registration-state";
import {
  compactDatabaseSslConfig,
  validateDatabaseSslConfig,
} from "../lib/database-ssl-config";
import { normalizeApiError } from "@/shared/api/normalized-api-error";

interface DatabaseServerWizardError {
  message: string;
  errorCode?: string;
  correlationId?: string;
}

function normalizedWizardError(error: unknown): DatabaseServerWizardError {
  const normalized = normalizeApiError(error);
  return {
    message: normalized.message,
    errorCode: normalized.errorCode,
    ...(normalized.correlationId
      ? { correlationId: normalized.correlationId }
      : {}),
  };
}

export function CreateDatabaseServerWizard() {
  const router = useRouter();
  const { createServer, checkConnectivity } = useDatabaseServers();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardError, setWizardError] =
    useState<DatabaseServerWizardError | null>(null);
  const [connectivityResult, setConnectivityResult] =
    useState<DatabaseServerConnectivityResult | null>(null);

  const [formData, setFormData] = useState<CreateDatabaseServerDto>(
    createDatabaseServerInitialValues,
  );
  const connectionStepIsValid = isDatabaseServerConnectionStepValid(formData);
  const securityAdminStepIsValid = isDatabaseSecurityAdminStepValid(
    formData.securityAdminCredentials,
  );

  const handleConnectivityCheck = async () => {
    if (!securityAdminStepIsValid) {
      setWizardError({
        message: "Enter a valid security-administrator username and password.",
      });
      return;
    }
    const sslMode = formData.sslMode ?? "disable";
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: formData.sslConfig,
    });
    if (sslErrors.length > 0) {
      setWizardError({ message: sslErrors[0] });
      return;
    }

    setIsSubmitting(true);
    setWizardError(null);
    setConnectivityResult(null);
    try {
      const sslConfig = compactDatabaseSslConfig(formData.sslConfig);
      const payload: CheckDatabaseServerConnectivityDto = {
        host: formData.host,
        port: formData.port,
        securityAdminCredentials: formData.securityAdminCredentials,
        sslMode: formData.sslMode,
        sslRejectUnauthorized: formData.sslRejectUnauthorized,
        ...(sslConfig ? { sslConfig } : {}),
        maintenanceDatabase: formData.maintenanceDatabase,
      };
      const res = await checkConnectivity(payload);
      if (res.connected) {
        setStep(3); // Proceed to Create Draft
      } else {
        setConnectivityResult(res);
        if (!res.checks?.length) {
          setWizardError({ message: "Connection failed: " + res.message });
        }
      }
    } catch (error) {
      setWizardError(normalizedWizardError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDraft = async () => {
    const sslMode = formData.sslMode ?? "disable";
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: formData.sslConfig,
    });
    if (sslErrors.length > 0) {
      setWizardError({ message: sslErrors[0] });
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    setWizardError(null);
    try {
      const { sslConfig: draftSslConfig, ...basePayload } = formData;
      const sslConfig = compactDatabaseSslConfig(draftSslConfig);
      const payload: CreateDatabaseServerDto = {
        ...basePayload,
        ...(sslConfig ? { sslConfig } : {}),
      };
      const server = await createServer(payload);
      // Once created, redirect to the server details page to finish bootstrapping and activation.
      router.push(`/database-servers/${server.id}`);
    } catch (error) {
      setWizardError(normalizedWizardError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm max-w-3xl mx-auto mt-6">
      <h2 className="text-xl font-bold mb-6">Register Database Server</h2>

      {/* Basic Wizard Progress */}
      <div className="flex gap-2 mb-8 text-sm">
        <div className={`flex-1 pb-2 border-b-2 ${step >= 1 ? "border-blue-600 font-bold" : "border-slate-200 text-slate-500"}`}>1. Connection & Capacity</div>
        <div className={`flex-1 pb-2 border-b-2 ${step >= 2 ? "border-blue-600 font-bold" : "border-slate-200 text-slate-500"}`}>2. Admin Access & TLS</div>
        <div className={`flex-1 pb-2 border-b-2 ${step >= 3 ? "border-blue-600 font-bold" : "border-slate-200 text-slate-500"}`}>3. Generate Access</div>
      </div>

      {wizardError && (
        <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <p>{wizardError.message}</p>
          {(wizardError.errorCode || wizardError.correlationId) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
              {wizardError.errorCode && <span>{wizardError.errorCode}</span>}
              {wizardError.correlationId && (
                <span>Correlation ID: {wizardError.correlationId}</span>
              )}
            </div>
          )}
        </div>
      )}

      {connectivityResult && !connectivityResult.connected && (
        <section
          role="alert"
          aria-labelledby="database-connectivity-failure-title"
          className="mb-4 overflow-hidden rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
        >
          <div className="border-b border-red-200 px-4 py-3 dark:border-red-900">
            <h3 id="database-connectivity-failure-title" className="text-sm font-bold text-red-800 dark:text-red-200">
              Database connection checks failed
            </h3>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              Fix the security-administrator connection, then test again.
            </p>
          </div>
          <ul className="divide-y divide-red-200 dark:divide-red-900">
            {connectivityResult.checks?.map((check) => (
              <li key={check.principal} className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {credentialCheckLabel(check.principal)}
                  </p>
                  <p className={`mt-1 break-words ${check.connected ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                    {check.message}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 font-bold ${check.connected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
                  {check.connected ? "Passed" : "Failed"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Server Name</label>
            <input
              aria-label="Server Name"
              required
              minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.name.minLength}
              maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.name.maxLength}
              className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Host</label>
              <input
                aria-label="Host"
                required
                minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.host.minLength}
                maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.host.maxLength}
                className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
                value={formData.host} onChange={e => setFormData({...formData, host: e.target.value})}
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium mb-1">Port</label>
              <input
                aria-label="Port"
                type="number"
                required
                min={DATABASE_SERVER_CREATE_CONSTRAINTS.port.min}
                max={DATABASE_SERVER_CREATE_CONSTRAINTS.port.max}
                step={1}
                className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
                value={formData.port} onChange={e => setFormData({...formData, port: Number(e.target.value)})}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Max Tenants Capacity</label>
            <input
              aria-label="Max Tenants Capacity"
              type="number"
              required
              min={DATABASE_SERVER_CREATE_CONSTRAINTS.maxTenants.min}
              max={DATABASE_SERVER_CREATE_CONSTRAINTS.maxTenants.max}
              step={1}
              className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
              value={formData.maxTenants} onChange={e => setFormData({...formData, maxTenants: Number(e.target.value)})}
            />
          </div>
          <div role="note" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            Supported engine: <strong>{DATABASE_ENGINE_REQUIREMENT.label}</strong>. PostgreSQL 15 and 17+ are rejected because the current backup/restore client is pinned to major 16.
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!connectionStepIsValid}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full disabled:opacity-50"
          >
            Next: Credentials
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* Security Admin Credentials */}
          <div className="p-4 border rounded-xl dark:border-slate-800">
            <h3 className="font-semibold mb-3 text-sm">Security Admin Credentials</h3>
            <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Used by Core only for restricted role administration. Application passwords are generated and encrypted server-side after the DRAFT server is created; they are never entered or downloaded here.
            </p>
            <div
              role="note"
              aria-label="Required PostgreSQL security administrator posture"
              className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300"
            >
              <p>
                Required: <strong>{DATABASE_SECURITY_ADMIN_POSTURE.requiredAttributes.join(" + ")}</strong>.
                Rejected: <strong>{DATABASE_SECURITY_ADMIN_POSTURE.rejectedAttributes.join(" / ")}</strong>.
              </p>
              <p className="mt-1">{DATABASE_SECURITY_ADMIN_POSTURE.membershipRule}</p>
            </div>
            <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Username must be 1–63 lowercase letters, digits, or underscores, start with a lowercase letter or underscore, and must not start with <code>pg_</code>.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <input aria-label="Security Admin Username" required minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminUsername.minLength} maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminUsername.maxLength} pattern={DATABASE_SECURITY_ADMIN_USERNAME_PATTERN.source} title="Use 1–63 lowercase letters, digits, or underscores; start with a lowercase letter or underscore; do not start with pg_." autoCapitalize="none" spellCheck={false} autoComplete="off" placeholder="Username" className="border rounded-lg p-2 text-sm dark:bg-slate-800" value={formData.securityAdminCredentials.username} onChange={e => setFormData({...formData, securityAdminCredentials: {...formData.securityAdminCredentials, username: e.target.value}})} />
              <input aria-label="Security Admin Password" required minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminPassword.minLength} maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminPassword.maxLength} autoComplete="new-password" type="password" placeholder="Password" className="border rounded-lg p-2 text-sm dark:bg-slate-800" value={formData.securityAdminCredentials.password} onChange={e => setFormData({...formData, securityAdminCredentials: {...formData.securityAdminCredentials, password: e.target.value}})} />
            </div>
          </div>

          <DatabaseSslConfigurationFields
            idPrefix="create-database-server-ssl"
            mode={(formData.sslMode ?? "disable") as DatabaseServerSslMode}
            rejectUnauthorized={formData.sslRejectUnauthorized ?? true}
            config={formData.sslConfig ?? {}}
            onModeChange={(sslMode) =>
              setFormData((current) => ({
                ...current,
                sslMode,
                ...(sslMode === "disable" ? { sslConfig: undefined } : {}),
              }))
            }
            onRejectUnauthorizedChange={(sslRejectUnauthorized) =>
              setFormData((current) => ({
                ...current,
                sslRejectUnauthorized,
              }))
            }
            onConfigChange={(sslConfig) =>
              setFormData((current) => ({ ...current, sslConfig }))
            }
            disabled={isSubmitting}
          />

          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Local development may use SSL mode <strong>disable</strong>. In production,
            Core rejects the check before opening a database connection unless SSL mode
            is <strong>verify-full</strong>, certificate verification is enabled, and an
            explicit CA certificate is provided.
          </p>

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            <p className="font-bold">Generated automatically after registration</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DATABASE_SECURITY_ADMIN_POSTURE.generatedPrincipals.map((item) => (
                <div key={item.principal} className="rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-900/70">
                  <p className="font-mono font-bold">{item.principal}</p>
                  <p className="mt-1 text-[11px] opacity-75">{item.capability}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 leading-5">
              {DATABASE_SECURITY_ADMIN_POSTURE.readAllDataRule} Generated passwords are never entered, revealed, downloaded, or stored by this browser.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-sm flex-1">Back</button>
            <button
              onClick={handleConnectivityCheck}
              disabled={
                isSubmitting ||
                !securityAdminStepIsValid
              }
              className="px-4 py-2 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-lg text-sm flex-1 disabled:opacity-50"
            >
              {isSubmitting ? "Testing..." : "Test Connectivity"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="p-6 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-center border border-green-200 dark:border-green-900">
            <h3 className="font-bold text-lg mb-2">Connectivity Verified</h3>
            <p className="text-sm">The PostgreSQL 16 server is reachable and credentials are valid.</p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Click below to create this server in <strong>DRAFT</strong> state and start secure registration setup. Core generates provisioning, required service, and independent Application access without returning passwords to the portal.
          </p>
          <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            Only Applications already marked <strong>ACTIVE + PUBLISHED</strong> and enabled for new servers receive database bindings during this step. If none are eligible yet, Core still preserves the server as a safe DRAFT and the detail screen guides you to Application Catalogue before retrying setup.
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(2)} className="px-4 py-2 border rounded-lg text-sm flex-1">Back</button>
            <button
              onClick={handleCreateDraft}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex-1 disabled:opacity-50"
            >
              {isSubmitting ? "Creating access..." : "Create & Generate Access"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
