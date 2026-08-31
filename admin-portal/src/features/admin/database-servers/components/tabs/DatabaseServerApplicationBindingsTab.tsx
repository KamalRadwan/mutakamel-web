import { Database, Plus, ShieldCheck, AlertCircle, Search } from "lucide-react";
import { Card, Input, Button, StatusBadge, Badge, DataTable, ErrorState, Field, type ColumnDef } from "@/design-system";
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
  const { lang, t } = useI18n();
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
          <div className="break-all font-mono font-semibold text-info-subtle-foreground">{binding.databasePrincipal}</div>
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
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-warning-subtle-foreground">
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
                {d.table.rotationDue.replace("{{date}}", new Date(binding.rotationDueAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US"))}
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
                className="border-warning/40 text-warning-subtle-foreground hover:bg-warning-subtle"
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
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground rtl:normal-case rtl:tracking-normal">
                <span className="rounded-lg bg-info-subtle p-1.5 text-info-subtle-foreground">
                  <Database className="size-4" aria-hidden="true" />
                </span>
                {d.title}
                <Badge tone="neutral">{bindings.length}</Badge>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{d.subtitle}</p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <Field label={lang === "ar" ? "البحث في الارتباطات" : "Search bindings"} className="min-w-0 flex-1 md:w-64">
                {(fieldProps) => (
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      {...fieldProps}
                      type="search"
                      value={bindingsSearch}
                      onChange={(event) => onBindingsSearchChange(event.target.value)}
                      placeholder={d.searchPlaceholder}
                      className="ps-9"
                    />
                  </div>
                )}
              </Field>

              {canBootstrapExisting && ["DRAFT", "ACTIVE", "DRAINING"].includes(server.status) && (
                <Button type="button" variant="outline" className="shrink-0" disabled={Boolean(credentialActionPending)} onClick={onAddApplicationOpen}>
                  <Plus className="size-4" aria-hidden="true" />
                  {d.addApplication}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-info/30 bg-info-subtle px-4 py-3 text-xs text-info-subtle-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            <p className="leading-relaxed">{d.boundaryNotice}</p>
          </div>

          {lastCredentialReceipt && (
            <div role="status" className="mt-3 grid gap-3 rounded-lg border border-success/30 bg-success-subtle px-4 py-3 text-xs text-success-subtle-foreground sm:grid-cols-3">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal">{d.lastOpTitle}</span>
                <span className="font-semibold">{"applications" in lastCredentialReceipt ? d.accessInit : d.credUpdated}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal">{d.affectedTitle}</span>
                <span className="font-mono">
                  {"applications" in lastCredentialReceipt
                    ? d.bindingsCount.replace("{{count}}", String(lastCredentialReceipt.applications.length))
                    : "applicationKey" in lastCredentialReceipt
                      ? lastCredentialReceipt.applicationKey
                      : lastCredentialReceipt.purpose}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal">{d.resultTitle}</span>
                <span className="font-semibold">{d.readyReceipt}</span>
              </div>
            </div>
          )}
        </div>

        {bindingsError && !isBindingsLoading ? (
          <ErrorState title={bindingsError} onRetry={() => void fetchBindings()} />
        ) : (
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
            emptyState={{ titleEn: d.table.empty, titleAr: d.table.empty }}
          />
        )}
      </Card>
    </div>
  );
}
