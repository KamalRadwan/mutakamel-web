import { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDatabaseServerDetail } from "./useDatabaseServerDetail";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { DatabaseServerProvisioningPrincipalBindingView } from "../types";

export type DatabaseServerTab = "overview" | "readiness" | "bindings" | "security" | "history";

export type LifecycleAction = "activate" | "drain" | "offline";

export function useDatabaseServerDetailPage(id: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang, dir, t } = useI18n();
  const [, startTransition] = useTransition();

  // Primary API & Data Hook
  const detailData = useDatabaseServerDetail(id);
  const {
    server,
    bindings,
    activateServer,
    drainServer,
    offlineServer,
    deleteServer,
  } = detailData;

  // RBAC Permissions
  const { user } = useAuth();
  const canUpdate = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_UPDATE);
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_DELETE);
  const canRegenerate = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_REGENERATE);
  const canReconcile = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_RECONCILE);
  const canBootstrapInitial = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_BOOTSTRAP_INITIAL);
  const canBootstrapExisting = adminCanAll(user, [...ADMIN_RBAC_CRITICAL.DB_SERVERS_BOOTSTRAP_EXISTING, "admin.applications.read"]);
  const canReadBackup = adminCan(user, "admin.backups.read");

  // Tab state & URL param sync
  const validTabs: DatabaseServerTab[] = ["overview", "readiness", "bindings", "security", "history"];
  const initialTabParam = searchParams.get("tab") as DatabaseServerTab | null;
  const activeTab: DatabaseServerTab = initialTabParam && validTabs.includes(initialTabParam) ? initialTabParam : "overview";

  const setActiveTab = (newTab: DatabaseServerTab) => {
    if (newTab === activeTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // Search filter for bindings table
  const [bindingsSearch, setBindingsSearch] = useState("");

  const filteredBindings = useMemo(() => {
    if (!bindingsSearch.trim()) return bindings;
    const q = bindingsSearch.toLowerCase();
    return bindings.filter(
      (b) =>
        b.applicationName.toLowerCase().includes(q) ||
        b.applicationKey.toLowerCase().includes(q) ||
        b.databasePrincipal.toLowerCase().includes(q),
    );
  }, [bindings, bindingsSearch]);

  // Modal visibility states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddApplicationOpen, setIsAddApplicationOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  const [isLifecycleSubmitting, setIsLifecycleSubmitting] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setIsEditModalOpen(false);
      setIsDeleteModalOpen(false);
      setIsAddApplicationOpen(false);
      setLifecycleAction(null);
      setLifecycleError(null);
      setIsDeleting(false);
      setIsLifecycleSubmitting(false);
    });
  }, [id]);

  // Derived readiness properties
  const provisioningPrincipal = server?.systemPrincipals.find(
    (binding): binding is DatabaseServerProvisioningPrincipalBindingView =>
      binding.purpose === "PROVISIONING" &&
      binding.databasePrincipal === "mutakamel_provisioner",
  );

  const backupDependencyNeedsAttention = server ? !server.hasBackupCredentials : false;

  // Lifecycle confirmation actions
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteServer();
      setIsDeleteModalOpen(false);
      router.push("/database-servers");
    } catch {
      // Handled inside hook toast
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLifecycleConfirm = async () => {
    if (!lifecycleAction) return;
    setIsLifecycleSubmitting(true);
    setLifecycleError(null);
    try {
      if (lifecycleAction === "activate") await activateServer();
      if (lifecycleAction === "drain") await drainServer();
      if (lifecycleAction === "offline") await offlineServer();
      setLifecycleAction(null);
    } catch (caught) {
      setLifecycleError(normalizeApiError(caught));
    } finally {
      setIsLifecycleSubmitting(false);
    }
  };

  return {
    ...detailData,
    lang,
    dir,
    t,
    // Permissions
    canUpdate,
    canDelete,
    canRegenerate,
    canReconcile,
    canBootstrapInitial,
    canBootstrapExisting,
    canReadBackup,
    // Tabs
    activeTab,
    setActiveTab,
    // Bindings filtering
    bindingsSearch,
    setBindingsSearch,
    filteredBindings,
    // Modals & Actions
    isEditModalOpen,
    setIsEditModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isDeleting,
    handleDeleteConfirm,
    isAddApplicationOpen,
    setIsAddApplicationOpen,
    lifecycleAction,
    setLifecycleAction,
    isLifecycleSubmitting,
    lifecycleError,
    setLifecycleError,
    handleLifecycleConfirm,
    // Derived
    provisioningPrincipal,
    backupDependencyNeedsAttention,
  };
}
