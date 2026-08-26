import { Database, Plus, ShieldCheck, AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { StatusBadge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type {
  DatabaseServerView,
  DatabaseServerApplicationBindingView,
  ApplicationCredentialBootstrapReceipt,
  ApplicationCredentialMutationReceipt,
  DatabaseServerSystemCredentialMutationReceipt,
} from "../../types";

interface DatabaseServerApplicationBindingsTabProps {
  server: DatabaseServerView;
  bindings: DatabaseServerApplicationBindingView[];
  filteredBindings: DatabaseServerApplicationBindingView[];
  bindingsSearch: string;
  onBindingsSearchChange: (q: string) => void;
  isBindingsLoading: boolean;
  bindingsError: string | null;
  fetchBindings: () => Promise<void>;
  lastCredentialReceipt: ApplicationCredentialBootstrapReceipt | ApplicationCredentialMutationReceipt | DatabaseServerSystemCredentialMutationReceipt | null;
  credentialActionPending: string | null;
  canBootstrapExisting: boolean;
  canRegenerate: boolean;
  canReconcile: boolean;
  onAddApplicationOpen: () => void;
  onOpenCredentialMutation: (
    action: "regenerate" | "reconcile",
    binding: DatabaseServerApplicationBindingView,
  ) => void;
}

export function DatabaseServerApplicationBindingsTab({
  server,
  bindings,
  filteredBindings,
  bindingsSearch,
  onBindingsSearchChange,
  isBindingsLoading,
  bindingsError,
  fetchBindings,
  lastCredentialReceipt,
  credentialActionPending,
  canBootstrapExisting,
  canRegenerate,
  canReconcile,
  onAddApplicationOpen,
  onOpenCredentialMutation,
}: DatabaseServerApplicationBindingsTabProps) {
  const { t } = useI18n();
  const d = t.databaseServerDetail.bindings;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
        {/* Header Toolbar */}
        <div className="border-b border-slate-100 dark:border-slate-800/80 p-5 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Database className="h-4 w-4" />
                </div>
                {d.title}
                <span className="ms-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {bindings.length}
                </span>
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {d.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 md:w-64">
                <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={bindingsSearch}
                  onChange={(e) => onBindingsSearchChange(e.target.value)}
                  placeholder={d.searchPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 ps-9 pe-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {canBootstrapExisting && ["DRAFT", "ACTIVE", "DRAINING"].includes(server.status) && (
                <button
                  type="button"
                  onClick={onAddApplicationOpen}
                  disabled={Boolean(credentialActionPending)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/30 cursor-pointer shadow-sm transition"
                >
                  <Plus className="h-4 w-4" />
                  {d.addApplication}
                </button>
              )}
            </div>
          </div>

          {/* Boundary Notice Banner */}
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="leading-relaxed">
              {d.boundaryNotice}
            </p>
          </div>

          {/* Last Receipt Summary */}
          {lastCredentialReceipt && (
            <div className="mt-3 grid gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 sm:grid-cols-3">
              <div>
                <span className="block text-2xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {d.lastOpTitle}
                </span>
                <span className="font-semibold">
                  {"applications" in lastCredentialReceipt ? d.accessInit : d.credUpdated}
                </span>
              </div>
              <div>
                <span className="block text-2xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {d.affectedTitle}
                </span>
                <span className="font-mono">
                  {"applications" in lastCredentialReceipt
                    ? `${lastCredentialReceipt.applications.length} binding(s)`
                    : "applicationKey" in lastCredentialReceipt
                      ? lastCredentialReceipt.applicationKey
                      : lastCredentialReceipt.purpose}
                </span>
              </div>
              <div>
                <span className="block text-2xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {d.resultTitle}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {d.readyReceipt}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                <th className="py-4 px-5 text-start">{d.table.application}</th>
                <th className="py-4 px-5 text-start">{d.table.principalKey}</th>
                <th className="py-4 px-5 text-start">{d.table.status}</th>
                <th className="py-4 px-5 text-start">{d.table.credRev}</th>
                <th className="py-4 px-5 text-start">{d.table.schedule}</th>
                <th className="py-4 px-5 text-start">{d.table.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isBindingsLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Loader2 className="me-2 inline h-4 w-4 animate-spin" />
                    {d.table.loading}
                  </td>
                </tr>
              ) : bindingsError ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-rose-600">
                    <p>{bindingsError}</p>
                    <button
                      type="button"
                      onClick={() => void fetchBindings()}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {d.table.retry}
                    </button>
                  </td>
                </tr>
              ) : filteredBindings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    {d.table.empty}
                  </td>
                </tr>
              ) : (
                filteredBindings.map((binding) => (
                  <tr
                    key={binding.applicationId}
                    className="group hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all h-[44px]"
                  >
                    <td className="py-3 px-5 font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {binding.applicationName}
                    </td>

                    <td className="py-3 px-5">
                      <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {binding.databasePrincipal}
                      </div>
                      <div className="font-mono text-xs text-slate-400 mt-0.5">
                        {binding.applicationKey}
                      </div>
                    </td>

                    <td className="py-3 px-5">
                      <StatusBadge status={binding.status} enumType="db-server" />
                      {binding.hasStagedCandidate && (
                        <div className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {d.table.stagedCandidate}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-5 font-mono font-semibold">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        v{binding.credentialRevision}
                      </span>
                    </td>

                    <td className="py-3 px-5">
                      {binding.rotationEnabled ? (
                        <>
                          <div>Every {binding.rotationIntervalHours}h</div>
                          {binding.rotationDueAt && (
                            <div className="text-xs text-slate-500">
                              Due: {new Date(binding.rotationDueAt).toLocaleString()}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">{d.table.disabled}</span>
                      )}
                    </td>

                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        {canRegenerate && binding.status === "READY" && (
                          <button
                            onClick={() => onOpenCredentialMutation("regenerate", binding)}
                            disabled={Boolean(credentialActionPending)}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            {t.databaseServerDetail.readiness.rotatePassword}
                          </button>
                        )}
                        {canReconcile &&
                          (binding.status === "ROTATING" ||
                            binding.status === "RECONCILING" ||
                            binding.hasStagedCandidate) && (
                            <button
                              onClick={() => onOpenCredentialMutation("reconcile", binding)}
                              disabled={Boolean(credentialActionPending)}
                              className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                            >
                              {t.databaseServerDetail.readiness.reconcile}
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
