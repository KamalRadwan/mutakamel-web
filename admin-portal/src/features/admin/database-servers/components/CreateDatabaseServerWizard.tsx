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
} from "../lib/registration-state";
import {
  compactDatabaseSslConfig,
  validateDatabaseSslConfig,
} from "../lib/database-ssl-config";

export function CreateDatabaseServerWizard() {
  const router = useRouter();
  const { createServer, checkConnectivity } = useDatabaseServers();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [connectivityResult, setConnectivityResult] =
    useState<DatabaseServerConnectivityResult | null>(null);

  const [formData, setFormData] = useState<CreateDatabaseServerDto>(
    createDatabaseServerInitialValues,
  );

  const handleConnectivityCheck = async () => {
    const sslMode = formData.sslMode ?? "disable";
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: formData.sslConfig,
    });
    if (sslErrors.length > 0) {
      setErrorMsg(sslErrors[0]);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
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
          setErrorMsg("Connection failed: " + res.message);
        }
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Connectivity check failed");
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
      setErrorMsg(sslErrors[0]);
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
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
      setErrorMsg(error instanceof Error ? error.message : "Creation failed");
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

      {errorMsg && (
        <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {errorMsg}
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
              className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Host</label>
              <input
                className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
                value={formData.host} onChange={e => setFormData({...formData, host: e.target.value})}
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium mb-1">Port</label>
              <input
                type="number" className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
                value={formData.port} onChange={e => setFormData({...formData, port: Number(e.target.value)})}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Max Tenants Capacity</label>
            <input
              type="number" className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800"
              value={formData.maxTenants} onChange={e => setFormData({...formData, maxTenants: Number(e.target.value)})}
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!formData.name || !formData.host}
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
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Username" className="border rounded-lg p-2 text-sm dark:bg-slate-800" value={formData.securityAdminCredentials.username} onChange={e => setFormData({...formData, securityAdminCredentials: {...formData.securityAdminCredentials, username: e.target.value}})} />
              <input type="password" placeholder="Password" className="border rounded-lg p-2 text-sm dark:bg-slate-800" value={formData.securityAdminCredentials.password} onChange={e => setFormData({...formData, securityAdminCredentials: {...formData.securityAdminCredentials, password: e.target.value}})} />
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

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            <p className="font-bold">Generated automatically after registration</p>
            <div className="mt-3 font-mono">
              <span className="rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-900/70">mutakamel_provisioner</span>
            </div>
            <p className="mt-3 leading-5">Core also generates all required service and Application access securely. No generated password is entered, revealed, downloaded, or stored by this browser.</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-sm flex-1">Back</button>
            <button
              onClick={handleConnectivityCheck}
              disabled={
                isSubmitting ||
                !formData.securityAdminCredentials.username ||
                !formData.securityAdminCredentials.password ||
                false
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
            <p className="text-sm">The database server is reachable and credentials are valid.</p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Click below to create this server in <strong>DRAFT</strong> state and start secure registration setup. Core generates provisioning, required service, and independent Application access without returning passwords to the portal.
          </p>
          <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            Only Applications already marked <strong>ACTIVE</strong> and enabled for new servers receive database bindings during this step. If none are active yet, Core still preserves the server as a safe DRAFT and the detail screen guides you to Application Catalogue before retrying setup.
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
