"use client";

import { useState } from "react";
import {
  DatabaseServerSslConfigDto,
  DatabaseServerSslMode,
  DatabaseServerView,
  UpdateDatabaseServerDto,
} from "../types";
import { databaseServersApi } from "../api/database-servers.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { useToast } from "@/components/ui/ToastContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { Edit2, X } from "lucide-react";
import { DatabaseSslConfigurationFields } from "./DatabaseSslConfigurationFields";
import {
  compactDatabaseSslConfig,
  validateDatabaseSslConfig,
} from "../lib/database-ssl-config";

interface EditDatabaseServerModalProps {
  isOpen: boolean;
  server: DatabaseServerView;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditDatabaseServerModal({
  isOpen,
  server,
  onClose,
  onSuccess,
}: EditDatabaseServerModalProps) {
  if (!isOpen) return null;

  return (
    <EditDatabaseServerModalContent
      key={`${server.id}:${server.updatedAt}`}
      server={server}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function EditDatabaseServerModalContent({
  server,
  onClose,
  onSuccess,
}: Omit<EditDatabaseServerModalProps, "isOpen">) {
  const toast = useToast();
  const { getIdempotencyKey, resetKey } = useIdempotency();

  const [name, setName] = useState(server.name);
  const [host, setHost] = useState(server.host);
  const [port, setPort] = useState(server.port);
  const [maxTenants, setMaxTenants] = useState(server.maxTenants);
  const [countryName, setCountryName] = useState(server.countryName || "");
  const [sslMode, setSslMode] = useState<DatabaseServerSslMode>(server.sslMode);
  const [sslRejectUnauthorized, setSslRejectUnauthorized] = useState(
    server.sslRejectUnauthorized,
  );
  const [sslConfig, setSslConfig] = useState<DatabaseServerSslConfigDto>({});
  const [removeSslConfig, setRemoveSslConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: sslConfig,
      hasStoredConfig: server.hasSslConfig,
      removeStoredConfig: removeSslConfig,
    });
    if (sslErrors.length > 0) {
      toast.error("Invalid TLS configuration", sslErrors[0]);
      return;
    }

    setIsSubmitting(true);

    const replacementSslConfig = compactDatabaseSslConfig(sslConfig);

    const dto: UpdateDatabaseServerDto = {
      name,
      host,
      port: Number(port),
      maxTenants: Number(maxTenants),
      ...(countryName ? { countryName } : {}),
      ...(sslMode !== server.sslMode ? { sslMode } : {}),
      ...(sslRejectUnauthorized !== server.sslRejectUnauthorized
        ? { sslRejectUnauthorized }
        : {}),
      ...(replacementSslConfig
        ? { sslConfig: replacementSslConfig }
        : removeSslConfig && server.hasSslConfig
          ? { removeSslConfig: true }
          : {}),
    };

    try {
      const key = getIdempotencyKey(dto);
      await databaseServersApi.update(server.id, dto, key);
      toast.success("Success", "Database server metadata updated.");
      resetKey();
      onSuccess();
      onClose();
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast.error("Update Failed", normalized.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl">
              <Edit2 className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Edit Database Server
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
              Server Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                Host / IP Address
              </label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-mono font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                Port
              </label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-mono font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                Max Tenants
              </label>
              <input
                type="number"
                required
                min={1}
                value={maxTenants}
                onChange={(e) => setMaxTenants(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-mono font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                Country Location
              </label>
              <input
                type="text"
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
                placeholder="e.g. Egypt, Saudi Arabia"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <DatabaseSslConfigurationFields
            idPrefix="edit-database-server-ssl"
            mode={sslMode}
            rejectUnauthorized={sslRejectUnauthorized}
            config={sslConfig}
            hasStoredConfig={server.hasSslConfig}
            removeStoredConfig={removeSslConfig}
            onModeChange={(nextMode) => {
              setSslMode(nextMode);
              if (nextMode === "disable") {
                setSslConfig({});
                setRemoveSslConfig(server.hasSslConfig);
              } else if (sslMode === "disable") {
                setRemoveSslConfig(false);
              }
            }}
            onRejectUnauthorizedChange={setSslRejectUnauthorized}
            onConfigChange={setSslConfig}
            onRemoveStoredConfigChange={setRemoveSslConfig}
            disabled={isSubmitting}
          />

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
