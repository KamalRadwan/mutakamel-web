"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useDashboards, type CreateDashboardInput, type DashboardWriteResult } from "./useDashboards";
import { useDashboardBlueprints } from "./useDashboardBlueprints";
import type { DashboardSummary } from "../dashboard-contract";

export function useDashboardsPage(enabled: boolean) {
  const list = useDashboards(enabled);
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [createFailureCode, setCreateFailureCode] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<DashboardSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const [pendingDuplicate, setPendingDuplicate] = useState<DashboardSummary | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateError, setDuplicateError] = useState<string>();
  const describe = (error: NormalizedApiError | null) => t.crmDashboards.errors[error?.code ?? ""] ?? t.crmDashboards.actionFailed;
  const navigate = (id: string) => router.push(`${TENANT_ROUTES.crmDashboards}/${id}`);
  const blueprints = useDashboardBlueprints(enabled && list.mayUseTemplates, navigate);
  const reloadRecovery = () => {
    void list.reload();
    if (blueprints.needsReconciliation) void blueprints.reload();
  };
  function report(result: DashboardWriteResult, title: string) {
    if (result.ignored || (!result.ok && !result.error)) return false;
    if (result.ok) {
      if (result.refreshFailed) toast.warning(t.crmDashboards.review.refreshFailed);
      else if (result.replayed) toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
      else toast.success(title);
      return true;
    }
    if (result.error && !toast.outcomeFromApi(result.error)) toast.errorFromApi(describe(result.error), result.error);
    return false;
  }
  async function create(input: CreateDashboardInput) {
    const result = await list.create(input);
    if (result.ignored) return;
    if (report(result, t.crmDashboards.created)) { setIsCreateOpen(false); if (result.createdId) navigate(result.createdId); }
    else { setCreateError(describe(result.error)); setCreateFailureCode(result.error?.code); }
  }
  async function remove() {
    if (!pendingDelete) return;
    const result = await list.remove(pendingDelete.id);
    if (result.ignored) return;
    if (report(result, t.crmDashboards.deleted)) setPendingDelete(null);
    else setDeleteError(describe(result.error));
  }
  async function duplicate() {
    if (!pendingDuplicate) return;
    const result = await list.duplicate(pendingDuplicate.id, duplicateName);
    if (result.ignored) return;
    if (report(result, t.crmDashboards.duplicated)) { setPendingDuplicate(null); if (result.createdId) navigate(result.createdId); }
    else setDuplicateError(describe(result.error));
  }
  async function openDefault() {
    const result = await list.openDefault();
    if (result.ok && result.createdId) navigate(result.createdId);
    else report(result, t.crmDashboards.openDefault);
  }
  async function standard() {
    const result = await list.ensureTemplate("CRM_DEFAULT");
    if (report(result, t.crmDashboards.standardReady) && result.createdId) navigate(result.createdId);
  }
  return { list, blueprints, reloadRecovery, navigate, isCreateOpen, setIsCreateOpen, createError, createFailureCode, create,
    openCreate: () => { setCreateError(undefined); setCreateFailureCode(undefined); setIsCreateOpen(true); },
    pendingDelete, deleteError, remove, setPendingDelete: (value: DashboardSummary | null) => { setDeleteError(undefined); setPendingDelete(value); },
    pendingDuplicate, setPendingDuplicate, duplicateName, setDuplicateName, duplicateError, duplicate,
    openDuplicate: (value: DashboardSummary) => { setDuplicateError(undefined); setDuplicateName(""); setPendingDuplicate(value); },
    setDefault: (value: DashboardSummary) => void list.setDefault(value.id).then((r) => report(r, t.crmDashboards.defaultChanged)),
    setFavorite: (value: DashboardSummary) => void list.setFavorite(value.id, !value.isFavorite).then((r) => report(r, t.crmDashboards.favoriteChanged)),
    openDefault, standard };
}

