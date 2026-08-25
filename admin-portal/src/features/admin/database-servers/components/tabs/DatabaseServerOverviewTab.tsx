import { Server, Globe, Shield, Clock, HardDrive, Cpu, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { DatabaseServerView } from "../../types";

interface DatabaseServerOverviewTabProps {
  server: DatabaseServerView;
}

export function DatabaseServerOverviewTab({ server }: DatabaseServerOverviewTabProps) {
  const { t } = useI18n();
  const d = t.databaseServerDetail.overview;

  const usageRatio = server.maxTenants > 0 ? Math.min(100, Math.round((server.currentTenants / server.maxTenants) * 100)) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-blue-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {d.maxCapacity}
            </div>
            <HardDrive className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {server.maxTenants}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">
            {d.maxCapacitySub}
          </div>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-cyan-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {d.currentTenants}
            </div>
            <Cpu className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-2 font-mono">
            {server.currentTenants}
          </div>
          <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold mt-1">
            {d.currentTenantsSub}
          </div>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-purple-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {d.sslSecurityMode}
            </div>
            <Shield className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-2 font-mono uppercase">
            {server.sslMode}
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1 truncate">
            {server.sslMode === "disable"
              ? "TLS disabled"
              : server.hasSslConfig
                ? `Bundle Configured`
                : server.sslRejectUnauthorized
                  ? "Encrypted · Strict"
                  : "Encrypted · Relaxed"}
          </div>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {d.connectTimeout}
            </div>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {server.connectTimeoutMs}
            <span className="text-xs ms-1">ms</span>
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            {d.connectTimeoutSub}
          </div>
        </div>
      </div>

      {/* Tenant Placement Usage Progress Bar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {d.capacityUtilization}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {d.tenantPlacementStatus}: <span className="font-bold text-slate-700 dark:text-slate-300">{server.currentTenants} / {server.maxTenants}</span>
            </p>
          </div>
          <span className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
            {usageRatio}%
          </span>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              usageRatio > 90
                ? "bg-gradient-to-r from-amber-500 to-rose-500"
                : usageRatio > 70
                  ? "bg-gradient-to-r from-blue-500 to-amber-500"
                  : "bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500"
            }`}
            style={{ width: `${usageRatio}%` }}
          />
        </div>
      </div>

      {/* Server & Host Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Server className="w-4 h-4 text-blue-500" />
            {d.hostInformation}
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-medium">{d.hostAddress}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{server.host}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-medium">{d.port}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{server.port}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-medium">{d.countryRegion}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                {server.countryName || server.countryIsoCode}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-medium">{d.placementStatus}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 font-mono uppercase">{server.status}</span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-slate-500 font-medium">{d.createdAt}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {new Date(server.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            {d.connectionParameters}
          </h3>

          <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold uppercase">
                PostgreSQL Core Driver Config
              </div>
              <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                postgres://[principal]:***@{server.host}:{server.port}/[tenant_db]?sslmode={server.sslMode}&connect_timeout={Math.round(server.connectTimeoutMs / 1000)}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tenant placements use this host as physical database server target. Schemas and databases are allocated dynamically under tenant provisioning workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
