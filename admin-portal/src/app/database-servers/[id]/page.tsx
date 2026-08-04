"use client";

import { use, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import {
  ArrowLeft,
  AlertCircle,
  Database,
  Loader2,
  ShieldCheck,
  Trash2,
  Play,
  StopCircle,
  PowerOff,
  Edit2,
  History,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useDatabaseServerDetail } from "@/features/admin/database-servers/hooks/useDatabaseServerDetail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { EditDatabaseServerModal } from "@/features/admin/database-servers/components/EditDatabaseServerModal";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DatabaseCredentialActionDialog } from "@/features/admin/database-servers/components/DatabaseCredentialActionDialog";
import { AddDatabaseApplicationDialog } from "@/features/admin/database-servers/components/AddDatabaseApplicationDialog";
import { SystemPrincipalRotationPolicy } from "@/features/admin/database-servers/components/SystemPrincipalRotationPolicy";
import type { DatabaseServerProvisioningPrincipalBindingView } from "@/features/admin/database-servers/types";
import { needsActiveApplicationBindingBackfill } from "@/features/admin/database-servers/lib/registration-state";

type LifecycleAction = "activate" | "drain" | "offline";

export default function DatabaseServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const {
    server,
    bindings,
    history,
    isLoading,
    error,
    fetchServer,
    fetchBindings,
    fetchHistory,
    isBindingsLoading,
    bindingsError,
    isHistoryLoading,
    historyError,
    drainServer,
    activateServer,
    offlineServer,
    deleteServer,
    lastCredentialReceipt,
    credentialActionPending,
    credentialAction,
    credentialReason,
    credentialActionError,
    openRetryBootstrap,
    openCredentialMutation,
    openSystemCredentialMutation,
    closeCredentialAction,
    setCredentialReason,
    submitCredentialAction,
    bootstrapApplication,
    updateProvisioningRotationPolicy,
  } = useDatabaseServerDetail(id);

  const { user } = useAuth();
  const canUpdate = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_UPDATE);
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_DELETE);

  const canRegenerate = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_REGENERATE);
  const canReconcile = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_RECONCILE);
  const canBootstrapInitial = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_BOOTSTRAP_INITIAL);
  const canBootstrapExisting = adminCanAll(user, [...ADMIN_RBAC_CRITICAL.DB_SERVERS_BOOTSTRAP_EXISTING, "admin.applications.read"]);
  const canReadBackup = adminCan(user, "admin.backups.read");
  const canReadApplications = adminCan(user, "admin.applications.read");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddApplicationOpen, setIsAddApplicationOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  const [isLifecycleSubmitting, setIsLifecycleSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col">
        <Navbar />
        <main className="flex-1 p-6">
          <div className="bg-white p-8 rounded-2xl text-center text-red-500 max-w-md mx-auto">
            {error || "Server not found"}
          </div>
        </main>
      </div>
    );
  }

  const provisioningPrincipal = server.systemPrincipals.find(
    (binding): binding is DatabaseServerProvisioningPrincipalBindingView =>
      binding.purpose === "PROVISIONING" &&
      binding.databasePrincipal === "mutakamel_provisioner",
  );
  // Database Servers consumes only Core's aggregate dependency signal. The
  // Backup principal lifecycle and status projection belong to /backup.
  const backupDependencyNeedsAttention = !server.hasBackupCredentials;
  const activeApplicationBindingsMissing = needsActiveApplicationBindingBackfill(
    server,
    bindings.length,
    !isBindingsLoading && !bindingsError,
  );

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteServer();
      setIsDeleteModalOpen(false);
      router.push("/database-servers");
    } catch {
      // handled in hook
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLifecycleConfirm = async () => {
    if (!lifecycleAction) return;
    setIsLifecycleSubmitting(true);
    try {
      if (lifecycleAction === "activate") await activateServer();
      if (lifecycleAction === "drain") await drainServer();
      if (lifecycleAction === "offline") await offlineServer();
      setLifecycleAction(null);
    } catch {
      // The hook exposes the normalized failure through the shared toast.
    } finally {
      setIsLifecycleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Modals */}
        {server && (
          <>
            <EditDatabaseServerModal
              isOpen={isEditModalOpen}
              server={server}
              onClose={() => setIsEditModalOpen(false)}
              onSuccess={fetchServer}
            />
            <DestructiveActionModal
              isOpen={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              onConfirm={handleDeleteConfirm}
              title="Delete Database Server"
              description="Deletion is available only when the server is empty and draining or offline."
              targetName={server.name}
              actionType="delete"
              requireNameTyping={true}
              isSubmitting={isDeleting}
            />
            <DestructiveActionModal
              isOpen={lifecycleAction !== null}
              onClose={() => setLifecycleAction(null)}
              onConfirm={() => void handleLifecycleConfirm()}
              title={lifecycleAction === "activate" ? "Activate Database Server" : lifecycleAction === "drain" ? "Drain Database Server" : "Take Database Server Offline"}
              description={lifecycleAction === "activate" ? "This server becomes eligible for new tenant placement." : lifecycleAction === "drain" ? "New tenant placement stops while existing tenants remain assigned." : "The server becomes unavailable for placement and connection operations."}
              targetName={server.name}
              actionType={lifecycleAction ?? "offline"}
              requireNameTyping={lifecycleAction === "offline"}
              isSubmitting={isLifecycleSubmitting}
            />
          </>
        )}

        {/* Header Hero Banner with Rich Colors */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl border border-blue-500/20 shadow-xl">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-teal-500/0 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <Link
                href="/database-servers"
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl transition-all shrink-0 shadow-sm backdrop-blur-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-gradient-to-tr from-blue-500 to-cyan-500 text-white rounded-xl shadow-md">
                    <Database className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl font-black font-mono text-white tracking-tight">
                    {server.name}
                  </h1>
                  <StatusBadge status={server.status} enumType="db-server" />
                </div>
                <p className="text-xs text-blue-200/80 mt-1 flex items-center gap-2 font-mono">
                  <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] border border-white/10">{server.host}:{server.port}</span>
                  <span>•</span>
                  <span>{server.countryName || server.countryIsoCode}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canUpdate && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all backdrop-blur-md cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-cyan-300" /> Edit Metadata
                </button>
              )}
              {canUpdate && server.status !== "ACTIVE" && (
                <button onClick={() => setLifecycleAction("activate")} disabled={server.credentialBootstrap.status !== "READY"} title={server.credentialBootstrap.status === "READY" ? "Activate server" : activeApplicationBindingsMissing ? "Activate the required Applications, then retry registration setup" : "Credential assembly must be READY before activation"} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 border border-white/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40">
                  <Play className="w-4 h-4" /> Activate Server
                </button>
              )}
              {canUpdate && server.status === "ACTIVE" && (
                <button onClick={() => setLifecycleAction("drain")} className="px-4 py-2.5 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-amber-400/30 backdrop-blur-md cursor-pointer">
                  <StopCircle className="w-4 h-4 text-amber-400" /> Drain Connections
                </button>
              )}
              {canUpdate && server.status !== "OFFLINE" && (
                <button onClick={() => setLifecycleAction("offline")} className="px-4 py-2.5 bg-slate-500/20 text-slate-200 hover:bg-slate-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-400/30 backdrop-blur-md cursor-pointer">
                  <PowerOff className="w-4 h-4 text-slate-400" /> Take Offline
                </button>
              )}
              {canDelete && (server.status === "OFFLINE" || server.status === "DRAINING") && server.currentTenants === 0 && (
                <button onClick={() => setIsDeleteModalOpen(true)} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-rose-600/20 cursor-pointer">
                  <Trash2 className="w-4 h-4" /> Delete Host
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider">Database access readiness</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Core verifies every required service and Application binding before this server can be activated.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1.5 text-xs font-black ${server.credentialBootstrap.status === "READY" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : server.credentialBootstrap.status === "DEGRADED" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>{server.credentialBootstrap.status}</span>
              <span className="font-mono text-xs">{server.credentialBootstrap.readyPrincipals}/{server.credentialBootstrap.totalPrincipals}</span>
              {canBootstrapInitial && server.status === "DRAFT" && server.credentialBootstrap.status !== "READY" && <button type="button" onClick={openRetryBootstrap} disabled={Boolean(credentialActionPending) || activeApplicationBindingsMissing} title={activeApplicationBindingsMissing ? "Activate the required Applications before retrying" : "Retry incomplete credential setup"} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Retry registration setup</button>}
            </div>
          </div>
          <div className="space-y-4 p-5">
            {activeApplicationBindingsMissing && (
              <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-bold">Active Application bindings are required</p>
                    <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-300">Activate the eligible database-backed Applications in Application Catalogue, then return here and retry registration setup. Core will backfill their fixed principals without exposing passwords.</p>
                  </div>
                </div>
                {canReadApplications && (
                  <Link href="/applications-catalogue?lifecycleStatus=DRAFT" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-950">
                    Open Application Catalogue
                  </Link>
                )}
              </div>
            )}

            {backupDependencyNeedsAttention && (
              <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold">Backup access requires attention</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">Server activation remains blocked until this dependency is ready.</p>
                </div>
                {canReadBackup && (
                  <Link href={`/backup/access?databaseServerId=${encodeURIComponent(server.id)}`} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950">
                    Open Backup
                  </Link>
                )}
              </div>
            )}

            {provisioningPrincipal ? (
              <article className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Provisioning service account</p><p className="mt-1 font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{provisioningPrincipal.databasePrincipal}</p></div>
                  <div className="text-end"><StatusBadge status={provisioningPrincipal.status} enumType="db-server" /><p className="mt-1 font-mono text-xs text-slate-500">revision {provisioningPrincipal.credentialRevision}</p></div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Used for tenant database creation and migrations. Its password remains encrypted inside Core.</p>
                {provisioningPrincipal.safeFailureCode && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 font-mono text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{provisioningPrincipal.safeFailureCode}</p>}
                <div className="mt-3 flex gap-2">
                  {canRegenerate && ["READY", "DEFERRED"].includes(provisioningPrincipal.status) && <button type="button" onClick={() => openSystemCredentialMutation("regenerate-system", provisioningPrincipal)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold dark:bg-slate-800">Rotate password</button>}
                  {canReconcile && (provisioningPrincipal.status === "ROTATING" || provisioningPrincipal.status === "RECONCILING" || provisioningPrincipal.hasStagedCandidate) && <button type="button" onClick={() => openSystemCredentialMutation("reconcile-system", provisioningPrincipal)} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Reconcile</button>}
                </div>
                <SystemPrincipalRotationPolicy binding={provisioningPrincipal} canUpdate={canUpdate} onSave={updateProvisioningRotationPolicy} />
              </article>
            ) : (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                <p className="text-sm font-bold">Provisioning access is unavailable</p>
                <p className="mt-1 text-xs leading-5">Retry server registration setup to restore the required provisioning binding.</p>
              </div>
            )}
          </div>
        </section>

        {/* Server Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-blue-500/20 shadow-sm">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Max Capacity</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{server.maxTenants}</div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">Tenant Placement Limit</div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-cyan-500/20 shadow-sm">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Tenants</div>
            <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1 font-mono">{server.currentTenants}</div>
            <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold mt-1">Active Schema Allocations</div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-purple-500/20 shadow-sm">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SSL Security Mode</div>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1 font-mono uppercase">{server.sslMode}</div>
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
              {server.sslMode === "disable"
                ? "TLS is disabled"
                : server.hasSslConfig
                  ? `Certificate bundle configured · ${server.sslRejectUnauthorized ? "strict verification" : "verification relaxed"}`
                  : server.sslRejectUnauthorized
                    ? "Encrypted transport · strict verification"
                    : "Encrypted transport · verification relaxed"}
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Connect Timeout</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{server.connectTimeoutMs}<span className="text-xs">ms</span></div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Host Health Check Window</div>
          </div>
        </div>

        {/* Application Bindings Matrix */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800/80 p-5 bg-slate-50/80 dark:bg-slate-800/50">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                    <Database className="h-4 w-4" />
                  </div>
                  Application Database Access Bindings
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Fixed principals, independent password revisions, and least-privilege bindings for this server.
                </p>
              </div>
              {canBootstrapExisting && ["DRAFT", "ACTIVE", "DRAINING"].includes(server.status) && (
                <button type="button" onClick={() => setIsAddApplicationOpen(true)} disabled={Boolean(credentialActionPending)} className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/30"><Plus className="h-3.5 w-3.5" />Add Application</button>
              )}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <p className="leading-relaxed">
                Passwords remain inside Core&apos;s encrypted credential boundary. This portal receives only principals, status, and revision evidence—never password files or reveal responses.
              </p>
            </div>

            {lastCredentialReceipt && (
              <div className="mt-3 grid gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 sm:grid-cols-3">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Last operation</span>
                  <span className="font-semibold">{"applications" in lastCredentialReceipt ? "Access initialized" : "Credential updated"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Affected</span>
                  <span className="font-mono">{"applications" in lastCredentialReceipt ? `${lastCredentialReceipt.applications.length} binding(s)` : "applicationKey" in lastCredentialReceipt ? lastCredentialReceipt.applicationKey : lastCredentialReceipt.purpose}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Result</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">READY · Secret-Free Receipt</span>
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider">
                  <th className="py-4 px-5 text-start">Application</th>
                  <th className="py-4 px-5 text-start">Principal / Key</th>
                  <th className="py-4 px-5 text-start">Status</th>
                  <th className="py-4 px-5 text-start">Credential Rev</th>
                  <th className="py-4 px-5 text-start">Rotation Schedule</th>
                  <th className="py-4 px-5 text-start">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isBindingsLoading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-500"><Loader2 className="me-2 inline h-4 w-4 animate-spin" />Loading Application bindings…</td></tr>
                ) : bindingsError ? (
                  <tr><td colSpan={6} className="py-10 text-center text-rose-600"><p>{bindingsError}</p><button type="button" onClick={() => void fetchBindings()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white"><RefreshCw className="h-3.5 w-3.5" />Retry</button></td></tr>
                ) : bindings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">No applications bound to this server</td>
                  </tr>
                ) : (
                  bindings.map((binding) => (
                    <tr key={binding.applicationId} className="group hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all">
                      <td className="py-4 px-5 font-bold text-sm text-slate-900 dark:text-slate-100">{binding.applicationName}</td>
                      <td className="py-4 px-5">
                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400">{binding.databasePrincipal}</div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{binding.applicationKey}</div>
                      </td>
                      <td className="py-4 px-5">
                        <StatusBadge status={binding.status} enumType="db-server" />
                        {binding.hasStagedCandidate && (
                          <div className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Staged Candidate
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5 font-mono font-bold">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          v{binding.credentialRevision}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        {binding.rotationEnabled ? (
                          <>
                            <div>Every {binding.rotationIntervalHours}h</div>
                            {binding.rotationDueAt && <div className="text-[10px] text-slate-500">Due: {new Date(binding.rotationDueAt).toLocaleString()}</div>}
                          </>
                        ) : (
                          <span className="text-slate-400">Disabled</span>
                        )}
                      </td>
                      <td className="py-3 px-4 flex gap-2">
                        {canRegenerate && binding.status === "READY" && (
                          <button
                            onClick={() => openCredentialMutation("regenerate", binding)}
                            disabled={Boolean(credentialActionPending)}
                            className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            Rotate password
                          </button>
                        )}
                        {canReconcile && (binding.status === "ROTATING" || binding.status === "RECONCILING" || binding.hasStagedCandidate) && (
                          <button
                            onClick={() => openCredentialMutation("reconcile", binding)}
                            disabled={Boolean(credentialActionPending)}
                            className="rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                          >
                            Reconcile
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Database Server History Log Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
              <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg">
                <History className="w-4 h-4" />
              </div>
              <span>Database Server Modification History</span>
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Total Log Entries: {history.length}</span>
          </div>

          <div className="p-6">
            {isHistoryLoading ? (
              <div className="py-6 text-center text-slate-400 text-xs">Loading history logs...</div>
            ) : historyError ? (
              <div className="py-8 text-center text-rose-600 text-xs"><p>{historyError}</p><button type="button" onClick={() => void fetchHistory()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-bold text-white"><RefreshCw className="h-3.5 w-3.5" />Retry</button></div>
            ) : history.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">No modification history logged yet.</div>
            ) : (
              <div className="space-y-4">
                {history.map((log) => (
                  <div key={log.id} className="border-b border-slate-100 dark:border-slate-800 pb-3 text-xs">
                    <div className="flex items-center justify-between font-mono mb-1">
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 uppercase">{log.action}</span>
                      <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {log.changes && log.changes.length > 0 && (
                      <div className="space-y-1 mt-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                        {log.changes.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-slate-400 font-bold">{c.label || c.field}:</span>
                            <span className="text-rose-500 line-through">{String(c.previousValue ?? "null")}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-500 font-bold">{String(c.newValue ?? "null")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>

      <DatabaseCredentialActionDialog
        action={credentialAction}
        reason={credentialReason}
        error={credentialActionError}
        pending={Boolean(credentialActionPending)}
        onReasonChange={setCredentialReason}
        onClose={closeCredentialAction}
        onSubmit={submitCredentialAction}
      />
      <AddDatabaseApplicationDialog isOpen={isAddApplicationOpen} boundApplicationKeys={bindings.map((binding) => binding.applicationKey)} isSubmitting={Boolean(credentialActionPending)} onClose={() => setIsAddApplicationOpen(false)} onBootstrap={bootstrapApplication} />
    </div>
  );
}
