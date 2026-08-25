import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Edit2,
  Play,
  StopCircle,
  PowerOff,
  Trash2,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useI18n } from "@/i18n/I18nContext";
import type { DatabaseServerView } from "../types";
import type { LifecycleAction } from "../hooks/useDatabaseServerDetailPage";

interface DatabaseServerHeaderHeroProps {
  server: DatabaseServerView;
  canUpdate: boolean;
  canDelete: boolean;
  onEditMetadata: () => void;
  onLifecycleAction: (action: LifecycleAction) => void;
  onDeleteHost: () => void;
}

export function DatabaseServerHeaderHero({
  server,
  canUpdate,
  canDelete,
  onEditMetadata,
  onLifecycleAction,
  onDeleteHost,
}: DatabaseServerHeaderHeroProps) {
  const { dir, t } = useI18n();
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const d = t.databaseServerDetail;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-blue-500/20 shadow-md">
      {/* Dynamic Background Glow */}
      <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-teal-500/0 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/database-servers"
            title={d.backToList}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl transition-all shrink-0 shadow-xs backdrop-blur-md"
          >
            <BackIcon className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 bg-gradient-to-tr from-blue-500 to-cyan-500 text-white rounded-lg shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold font-mono text-white tracking-tight">
                {server.name}
              </h1>
              <StatusBadge status={server.status} enumType="db-server" />
            </div>

            <p className="text-xs text-blue-200/80 mt-1.5 flex items-center gap-2 font-mono">
              <span className="bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10 font-bold">
                {server.host}:{server.port}
              </span>
              <span>•</span>
              <span className="font-sans font-semibold">
                {server.countryName || server.countryIsoCode}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <button
              onClick={onEditMetadata}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all backdrop-blur-md cursor-pointer"
            >
              <Edit2 className="w-4 h-4 text-cyan-300" /> {d.editMetadata}
            </button>
          )}

          {canUpdate && server.status !== "ACTIVE" && (
            <button
              onClick={() => onLifecycleAction("activate")}
              disabled={server.credentialBootstrap.status !== "READY"}
              title={
                server.credentialBootstrap.status === "READY"
                  ? d.activateServer
                  : d.readiness.subtitle
              }
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 border border-white/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="w-4 h-4" /> {d.activateServer}
            </button>
          )}

          {canUpdate && server.status === "ACTIVE" && (
            <button
              onClick={() => onLifecycleAction("drain")}
              className="px-4 py-2.5 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-amber-400/30 backdrop-blur-md cursor-pointer"
            >
              <StopCircle className="w-4 h-4 text-amber-400" /> {d.drainConnections}
            </button>
          )}

          {canUpdate && server.status !== "OFFLINE" && (
            <button
              onClick={() => onLifecycleAction("offline")}
              className="px-4 py-2.5 bg-slate-500/20 text-slate-200 hover:bg-slate-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-400/30 backdrop-blur-md cursor-pointer"
            >
              <PowerOff className="w-4 h-4 text-slate-400" /> {d.takeOffline}
            </button>
          )}

          {canDelete &&
            (server.status === "OFFLINE" || server.status === "DRAINING") &&
            server.currentTenants === 0 && (
              <button
                onClick={onDeleteHost}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> {d.deleteHost}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
