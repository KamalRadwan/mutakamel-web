"use client";

import { use } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { EditDatabaseServerModal } from "@/features/admin/database-servers/components/EditDatabaseServerModal";
import { DatabaseCredentialActionDialog } from "@/features/admin/database-servers/components/DatabaseCredentialActionDialog";
import { AddDatabaseApplicationDialog } from "@/features/admin/database-servers/components/AddDatabaseApplicationDialog";
import { useDatabaseServerDetailPage } from "@/features/admin/database-servers/hooks/useDatabaseServerDetailPage";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import { useI18n } from "@/i18n/I18nContext";

// Header & Tabs Components
import { DatabaseServerHeaderHero } from "@/features/admin/database-servers/components/DatabaseServerHeaderHero";
import { DatabaseServerTabsNav } from "@/features/admin/database-servers/components/DatabaseServerTabsNav";

// Tab Views
import { DatabaseServerOverviewTab } from "@/features/admin/database-servers/components/tabs/DatabaseServerOverviewTab";
import { DatabaseServerReadinessTab } from "@/features/admin/database-servers/components/tabs/DatabaseServerReadinessTab";
import { DatabaseServerApplicationBindingsTab } from "@/features/admin/database-servers/components/tabs/DatabaseServerApplicationBindingsTab";
import { DatabaseServerSecurityTab } from "@/features/admin/database-servers/components/tabs/DatabaseServerSecurityTab";
import { DatabaseServerHistoryTab } from "@/features/admin/database-servers/components/tabs/DatabaseServerHistoryTab";

export default function DatabaseServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { user, isLoading } = useAuth();
  const { lang } = useI18n();
  if (isLoading) {
    return <DatabaseServerDetailBoundary lang={lang} loading />;
  }
  if (!adminCan(user, "admin.database_servers.read")) {
    return <DatabaseServerDetailBoundary lang={lang} />;
  }
  return <DatabaseServerDetailContent id={resolvedParams.id} />;
}

function DatabaseServerDetailContent({ id }: { id: string }) {
  const page = useDatabaseServerDetailPage(id);

  if (page.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-canvas flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  if (page.error || !page.server) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-canvas flex flex-col">
        <Navbar />
        <main className="flex-1 p-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl text-center text-red-500 max-w-md mx-auto shadow-md border border-slate-200 dark:border-slate-800">
            {page.error || "Server not found"}
          </div>
        </main>
      </div>
    );
  }

  const { server } = page;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-canvas text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 space-y-6 w-full px-4 py-4 sm:py-6">
        {/* Modals & Dialogs */}
        <EditDatabaseServerModal
          isOpen={page.isEditModalOpen}
          server={server}
          onClose={() => page.setIsEditModalOpen(false)}
          onSuccess={page.fetchServer}
        />
        <DestructiveActionModal
          isOpen={page.isDeleteModalOpen}
          onClose={() => page.setIsDeleteModalOpen(false)}
          onConfirm={page.handleDeleteConfirm}
          title="Delete Database Server"
          description="Deletion is available only when the server is empty and draining or offline."
          targetName={server.name}
          actionType="delete"
          requireNameTyping={true}
          isSubmitting={page.isDeleting}
        />
        <DestructiveActionModal
          isOpen={page.lifecycleAction !== null}
          onClose={() => {
            page.setLifecycleAction(null);
            page.setLifecycleError(null);
          }}
          onConfirm={() => void page.handleLifecycleConfirm()}
          title={
            page.lifecycleAction === "activate"
              ? "Activate Database Server"
              : page.lifecycleAction === "drain"
                ? "Drain Database Server"
                : "Take Database Server Offline"
          }
          description={
            page.lifecycleAction === "activate"
              ? "This server becomes eligible for new tenant placement."
              : page.lifecycleAction === "drain"
                ? "New tenant placement stops while existing tenants remain assigned."
                : "The server becomes unavailable for placement and connection operations."
          }
          targetName={server.name}
          actionType={page.lifecycleAction ?? "offline"}
          requireNameTyping={page.lifecycleAction === "offline"}
          isSubmitting={page.isLifecycleSubmitting}
        />

        {/* Lifecycle Error Alert */}
        {page.lifecycleError && (
          <section
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-semibold">{page.lifecycleError.message}</p>
                <p className="mt-1 font-mono text-xs">
                  {page.lifecycleError.errorCode}
                </p>
                {page.lifecycleError.details ? (
                  <ul className="mt-3 space-y-1 text-xs leading-5">
                    {Object.entries(page.lifecycleError.details).flatMap(
                      ([field, values]) =>
                        values.map((value) => (
                          <li
                            key={`${field}:${value}`}
                            className="break-words font-mono"
                          >
                            {field}: {value}
                          </li>
                        )),
                    )}
                  </ul>
                ) : null}
                {page.lifecycleError.correlationId ? (
                  <p className="mt-2 text-xs">
                    Correlation ID:{" "}
                    <code>{page.lifecycleError.correlationId}</code>
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {/* Header Hero */}
        <DatabaseServerHeaderHero
          server={server}
          canUpdate={page.canUpdate}
          canDelete={page.canDelete}
          onEditMetadata={() => page.setIsEditModalOpen(true)}
          onLifecycleAction={(action) => {
            page.setLifecycleError(null);
            page.setLifecycleAction(action);
          }}
          onDeleteHost={() => page.setIsDeleteModalOpen(true)}
        />

        {/* Tabs Navigation Bar */}
        <DatabaseServerTabsNav
          activeTab={page.activeTab}
          onTabChange={page.setActiveTab}
          bindingsCount={page.bindings.length}
          historyCount={page.history.length}
          bootstrapStatus={server.credentialBootstrap.status}
        />

        {/* Active Tab Panel Rendering */}
        <div className="pt-2">
          {page.activeTab === "overview" && (
            <DatabaseServerOverviewTab server={server} />
          )}

          {page.activeTab === "readiness" && (
            <DatabaseServerReadinessTab
              server={server}
              provisioningPrincipal={page.provisioningPrincipal}
              backupDependencyNeedsAttention={
                page.backupDependencyNeedsAttention
              }
              canBootstrapInitial={page.canBootstrapInitial}
              canReadBackup={page.canReadBackup}
              canRegenerate={page.canRegenerate}
              canReconcile={page.canReconcile}
              canUpdate={page.canUpdate}
              credentialActionPending={page.credentialActionPending}
              onRetryBootstrap={page.openRetryBootstrap}
              onSystemCredentialMutation={page.openSystemCredentialMutation}
              onUpdateProvisioningRotationPolicy={
                page.updateProvisioningRotationPolicy
              }
            />
          )}

          {page.activeTab === "bindings" && (
            <DatabaseServerApplicationBindingsTab
              server={server}
              bindings={page.bindings}
              filteredBindings={page.filteredBindings}
              bindingsSearch={page.bindingsSearch}
              onBindingsSearchChange={page.setBindingsSearch}
              isBindingsLoading={page.isBindingsLoading}
              bindingsError={page.bindingsError}
              fetchBindings={page.fetchBindings}
              lastCredentialReceipt={page.lastCredentialReceipt}
              credentialActionPending={page.credentialActionPending}
              canBootstrapExisting={page.canBootstrapExisting}
              canRegenerate={page.canRegenerate}
              canReconcile={page.canReconcile}
              onAddApplicationOpen={() => page.setIsAddApplicationOpen(true)}
              onOpenCredentialMutation={page.openCredentialMutation}
            />
          )}

          {page.activeTab === "security" && (
            <DatabaseServerSecurityTab server={server} />
          )}

          {page.activeTab === "history" && (
            <DatabaseServerHistoryTab
              history={page.history}
              isHistoryLoading={page.isHistoryLoading}
              historyError={page.historyError}
              fetchHistory={page.fetchHistory}
            />
          )}
        </div>
      </main>

      {/* Action Dialogs */}
      <DatabaseCredentialActionDialog
        action={page.credentialAction}
        reason={page.credentialReason}
        error={page.credentialActionError}
        pending={Boolean(page.credentialActionPending)}
        onReasonChange={page.setCredentialReason}
        onClose={page.closeCredentialAction}
        onSubmit={page.submitCredentialAction}
      />
      <AddDatabaseApplicationDialog
        isOpen={page.isAddApplicationOpen}
        boundApplicationKeys={page.bindings.map((b) => b.applicationKey)}
        isSubmitting={Boolean(page.credentialActionPending)}
        onClose={() => page.setIsAddApplicationOpen(false)}
        onBootstrap={page.bootstrapApplication}
      />
    </div>
  );
}

function DatabaseServerDetailBoundary({
  lang,
  loading = false,
}: {
  lang: "ar" | "en";
  loading?: boolean;
}) {
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="flex min-h-screen flex-col bg-slate-50 dark:bg-canvas"
    >
      <Navbar />
      <main className="grid flex-1 place-items-center p-6">
        <section
          role={loading ? "status" : undefined}
          className="flex max-w-xl flex-col items-center rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          {loading ? (
            <Loader2 className="size-8 animate-spin text-blue-600" />
          ) : (
            <ShieldAlert className="size-8 text-amber-500" />
          )}
          <h1 className="mt-3 font-semibold">
            {loading
              ? lang === "ar"
                ? "جارٍ التحقق من الصلاحيات..."
                : "Checking database-server access..."
              : lang === "ar"
                ? "لا تملك صلاحية عرض هذا الخادم."
                : "You do not have permission to view this database server."}
          </h1>
        </section>
      </main>
    </div>
  );
}
