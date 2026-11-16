"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { isPlaceableWidget, type WidgetLibraryItem } from "../../dashboards/widget-library-contract";
import { useWidgets, type WidgetWriteResult } from "./useWidgets";

export function useWidgetLibraryPage() {
  const list = useWidgets();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ scope: string; kind: "clone" | "delete"; target: WidgetLibraryItem } | null>(null);
  const [failure, setFailure] = useState<{ scope: string; error: NormalizedApiError | null; uncertain?: boolean } | null>(null);
  const [cloneName, setCloneName] = useState("");
  const active = dialog?.scope === list.scope ? dialog : null;
  const error = failure?.scope === list.scope ? failure : null;
  const describe = (value: NormalizedApiError | null) => value?.status === 403 ? t.crmWidgets.review.writeDenied
    : t.crmDashboards.errors[value?.code ?? ""] ?? t.crmDashboards.actionFailed;
  const open = (kind: "clone" | "delete", target: WidgetLibraryItem) => {
    if (list.blocked || list.pendingId || list.isSubmitting) return;
    setFailure(null); setCloneName(""); setDialog({ scope: list.scope, kind, target });
  };
  const report = (result: WidgetWriteResult, success: string) => {
    if (result.stale) return;
    if (result.ok) {
      setDialog(null); setFailure(null); toast.success(success);
      if (result.reconciled === false) toast.info(t.crmWidgets.review.savedRefreshFailed);
    } else {
      setFailure({ scope: list.scope, error: result.error, uncertain: result.uncertain });
      if (result.error) toast.outcomeFromApi(result.error);
    }
  };
  return { list, active, cloneName, setCloneName,
    error: error?.uncertain ? t.crmWidgets.review.uncertain : error?.error ? describe(error.error) : undefined,
    openCreate: () => { if (list.canCreate && !list.blocked && !list.isPending()) router.push(TENANT_ROUTES.crmWidgetNew); },
    openClone: (target: WidgetLibraryItem) => { if (list.canCreate && isPlaceableWidget(target)) open("clone", target); },
    openDelete: (target: WidgetLibraryItem) => { if (list.canDelete && target.accessLevel === "OWNER") open("delete", target); },
    close: () => { if (!list.isPending()) setDialog(null); },
    clone: async () => {
      if (active?.kind !== "clone" || cloneName.trim().length > 120) return;
      const result = await list.clone(active.target.id, cloneName);
      report(result, t.crmWidgets.lifecycle.clonedDraft);
      if (result.ok && !result.stale && result.createdId) router.push(`${TENANT_ROUTES.crmWidgets}/${result.createdId}`);
    },
    remove: async () => { if (active?.kind === "delete" && active.target) report(await list.remove(active.target.id), t.crmWidgets.deleted); },
    openDetail: (target: WidgetLibraryItem) => router.push(`${TENANT_ROUTES.crmWidgets}/${target.id}`),
    reload: () => { if (!list.pendingId && !list.isSubmitting) void list.reload(); },
  };
}
