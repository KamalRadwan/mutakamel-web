"use client";

import { useState } from "react";
import { Server, Loader2, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface CreateDatabaseServerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isTestingConnection: boolean;
  connectionResult: { connected: boolean; message: string } | null;
  onCheckConnectivity: () => void;
}

export function CreateDatabaseServerDrawer({
  isOpen,
  onClose,
  isTestingConnection,
  connectionResult,
  onCheckConnectivity,
}: CreateDatabaseServerDrawerProps) {
  const { t } = useI18n();

  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: 5432,
    maxTenants: 50,
    username: "",
    password: "",
    sslMode: "require",
    maintenanceDatabase: "postgres",
    countryIsoCode: "EG",
    region: "Middle East",
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg h-full bg-white dark:bg-slate-900 border-s border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.dbServers.registerTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.dbServers.registerSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {/* Connectivity Test Alert */}
        {connectionResult && (
          <div
            className={`p-3 text-xs font-semibold rounded-xl border flex items-center gap-2 ${
              connectionResult.connected
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
            }`}
          >
            {connectionResult.connected ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{connectionResult.message}</span>
          </div>
        )}

        {/* Form Body */}
        <form className="space-y-4 flex-1">
          {/* Server Name & Host */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.hostName}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.dbServers.hostNamePlaceholder}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.hostAddress}
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder={t.dbServers.hostAddressPlaceholder}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                required
              />
            </div>
          </div>

          {/* Port & Max Tenants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.port}
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.maxTenants}
              </label>
              <input
                type="number"
                value={formData.maxTenants}
                onChange={(e) => setFormData({ ...formData, maxTenants: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                required
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.dbUser}
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.dbPassword}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* SSL Mode & Country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.sslMode}
              </label>
              <select
                value={formData.sslMode}
                onChange={(e) => setFormData({ ...formData, sslMode: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              >
                <option value="disable">disable</option>
                <option value="require">require</option>
                <option value="verify-ca">verify-ca</option>
                <option value="verify-full">verify-full</option>
              </select>
            </div>

            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.dbServers.countryIso}
              </label>
              <select
                value={formData.countryIsoCode}
                onChange={(e) => setFormData({ ...formData, countryIsoCode: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              >
                <option value="EG">مصر (EG)</option>
                <option value="SA">المملكة العربية السعودية (SA)</option>
                <option value="AE">الإمارات (AE)</option>
              </select>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCheckConnectivity}
            disabled={isTestingConnection}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.dbServers.testingConnectivity}</span>
              </>
            ) : (
              <span>{t.dbServers.testConnectionBtn}</span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
          >
            {t.dbServers.saveServer}
          </button>
        </div>
      </div>
    </div>
  );
}
