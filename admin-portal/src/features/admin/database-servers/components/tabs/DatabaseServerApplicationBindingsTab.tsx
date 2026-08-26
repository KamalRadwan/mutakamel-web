import { Database, Plus, ShieldCheck, AlertCircle, Search } from "lucide-react";
import { Card, Input, Button, StatusBadge, Badge, DataTable, type ColumnDef } from "@/design-system";
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
  const r = t.databaseServerDetail.readiness;

  const columns: ColumnDef<DatabaseServerApplicationBindingView>[] = [
    {
      key: "application",
      headerEn: d.table.application,
      headerAr: d.table.application,
      cell: (binding) => <span className="text-sm font-semibold text-foreground">{binding.applicationName}</span>,
    },
    {
      key: "principal",
      headerEn: d.table.principalKey,
      headerAr: d.table.principalKey,
      cell: (binding) => (
        <div>
          <div className="font-mono font-semibold text-brand-700 dark:text-brand-400">{binding.databasePrincipal}</div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{binding.applicationKey}</div>
        </div>
      ),
    },
    {
      key: "status",
      headerEn: d.table.status,
      headerAr: d.table.status,
      cell: (binding) => (
        <div>
          <StatusBadge status={binding.status} enumType="db-server" />
          {binding.hasStagedCandidate && (
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-warn-700 dark:text-warn-400">
              <AlertCircle className="size-3" aria-hidden="true" />
              {d.table.stagedCandidate}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "credRev",
      headerEn: d.table.credRev,
      headerAr: d.table.credRev,
      cell: (binding) => (
        <span className="rounded-lg border border-border bg-muted px-2.5 py-1 font-mono font-semibold text-foreground">
          v{binding.credentialRevision}
        </span>
      ),
    },
    {
      key: "schedule",
      headerEn: d.table.schedule,
      headerAr: d.table.schedule,
      cell: (binding) =>
        binding.rotationEnabled ? (
          <div>
            <div>{d.table.rotationEvery.replace("{{hours}}", String(binding.rotationIntervalHours))}</div>
            {binding.rotationDueAt && (
              <div className="text-xs text-muted-foreground">
                {d.table.rotationDue.replace("{{date}}", new Date(binding.rotationDueAt).toLocaleString())}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">{d.table.disabled}</span>
        ),
    },
    {
      key: "actions",
      headerEn: d.table.actions,
      headerAr: d.table.actions,
      cell: (binding) => (
        <div className="flex gap-2">
          {canRegenerate && binding.status === "READY" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={Boolean(credentialActionPending)}
              onClick={() => onOpenCredentialMutation("regenerate", binding)}
            >
              {r.rotatePassword}
            </Button>
          )}
          {canReconcile &&
            (binding.status === "ROTATING" || binding.status === "RECONCILING" || binding.hasStagedCandidate) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-warn-300 text-warn-700 hover:bg-warn-100 dark:border-warn-800 dark:text-warn-300 dark:hover:bg-warn-950/40"
                disabled={Boolean(credentialActionPending)}
                onClick={() => onOpenCredentialMutation("reconcile", binding)}
              >
                {r.reconcile}
              </Button>
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="border-b border-border bg-muted p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
                <span className="rounded-lg bg-brand-500/10 p-1.5 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                  <Database className="size-4" aria-hidden="true" />
                </span>
                {d.title}
                <Badge tone="brand">{bindings.length}</Badge>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{d.subtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="text"
                  value={bindingsSearch}
                  onChange={(event) => onBindingsSearchChange(event.target.value)}
                  placeholder={d.searchPlaceholder}
                  className="ps-9"
                />
              </div>

              {canBootstrapExisting && ["DRAFT", "ACTIVE", "DRAINING"].includes(server.status) && (
                <Button type="button" variant="outline" className="shrink-0" disabled={Boolean(credentialActionPending)} onClick={onAddApplicationOpen}>
                  <Plus className="size-4" aria-hidden="true" />
                  {d.addApplication}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-brand-500/30 bg-brand-500/5 px-4 py-3 text-xs text-foreground dark:bg-brand-500/10">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <p className="leading-relaxed">{d.boundaryNotice}</p>
          </div>

          {lastCredentialReceipt && (
            <div className="mt-3 grid gap-3 rounded-lg border border-brand-500/30 bg-brand-500/5 px-4 py-3 text-xs text-foreground dark:bg-brand-500/10 sm:grid-cols-3">
              <div>
                <span className="block text-2xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">{d.lastOpTitle}</span>
                <span className="font-semibold">{"applications" in lastCredentialReceipt ? d.accessInit : d.credUpdated}</span>
              </div>
              <div>
                <span className="block text-2xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">{d.affectedTitle}</span>
                <span className="font-mono">
                  {"applications" in lastCredentialReceipt
                    ? d.bindingsCount.replace("{{count}}", String(lastCredentialReceipt.applications.length))
                    : "applicationKey" in lastCredentialReceipt
                      ? lastCredentialReceipt.applicationKey
                      : lastCredentialReceipt.purpose}
                </span>
              </div>
              <div>
                <span className="block text-2xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">{d.resultTitle}</span>
                <span className="font-semibold text-brand-700 dark:text-brand-400">{d.readyReceipt}</span>
              </div>
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filteredBindings}
          isLoading={isBindingsLoading}
          getRowId={(binding) => binding.applicationId}
          pagination={{
            page: 1,
            limit: Math.max(filteredBindings.length, 1),
            totalItems: filteredBindings.length,
            totalPages: 1,
            onPageChange: () => {},
          }}
          emptyState={{
            titleEn: bindingsError ?? d.table.empty,
            titleAr: bindingsError ?? d.table.empty,
            action: bindingsError ? (
              <Button type="button" variant="destructive" size="sm" onClick={() => void fetchBindings()}>
                {d.table.retry}
              </Button>
            ) : undefined,
          }}
        />
      </Card>
    </div>
  );
}
