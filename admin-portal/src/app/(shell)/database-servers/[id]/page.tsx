"use client";

import { use } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { ErrorState, Card } from "@/design-system";
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
  const { t } = useI18n();
  const d = t.databaseServerDetail;

  if (page.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
      </div>
    );
  }

  if (page.error || !page.server) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <ErrorState title={page.error || "Server not found"} />
      </div>
    );
  }

  const { server } = page;

  return (
    <div className="space-y-6 w-full">
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
          title={d.deleteHost}
          description={d.deleteHostDescription}
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
              ? d.activateServer
              : page.lifecycleAction === "drain"
                ? d.drainConnections
                : d.takeOffline
          }
          description={
            page.lifecycleAction === "activate"
              ? d.activateServerDescription
              : page.lifecycleAction === "drain"
                ? d.drainConnectionsDescription
                : d.takeOfflineDescription
          }
          targetName={server.name}
          actionType={page.lifecycleAction ?? "offline"}
          requireNameTyping={page.lifecycleAction === "offline"}
          isSubmitting={page.isLifecycleSubmitting}
        />

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
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="grid place-items-center py-16">
      <Card role={loading ? "status" : undefined} className="flex max-w-xl flex-col items-center p-8 text-center text-foreground">
        {loading ? (
          <Loader2 className="size-8 animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-8 text-warn-600 dark:text-warn-400" aria-hidden="true" />
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
      </Card>
    </div>
  );
}
