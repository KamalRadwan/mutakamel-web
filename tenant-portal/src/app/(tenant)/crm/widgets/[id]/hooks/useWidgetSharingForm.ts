"use client";
import { useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { ShareAccessLevel, ShareTarget } from "../../../dashboards/share-contract";
import type { useWidgetShareGrants } from "./useWidgetShareGrants";
export function useWidgetSharingForm(shares: ReturnType<typeof useWidgetShareGrants>) {
  const { t } = useI18n();
  const toast = useToast();
  const [selection, setSelection] = useState<{ scope: string; target?: ShareTarget; level: ShareAccessLevel; expiry: string }>({ scope: shares.scope, level: "VIEW", expiry: "" });
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const active = selection.scope === shares.scope ? selection : { scope: shares.scope, level: "VIEW" as const, expiry: "", target: undefined };
  const expiryError = active.expiry && (!Number.isFinite(Date.parse(active.expiry)) || Date.parse(active.expiry) <= checkedAt) ? t.crmWidgets.review.expiryInvalid : undefined;
  const guard = useUnsavedChangesGuard(!!active.target || !!active.expiry || shares.isSubmitting);
  const report = (result: Awaited<ReturnType<typeof shares.share>>, label: string) => {
    if (result.stale) return;
    if (result.ok) { toast.success(label); setFailure(null); setSelection({ scope: shares.scope, level: "VIEW", expiry: "" }); if (result.refreshed === false) toast.info(t.crmWidgets.review.savedRefreshFailed); }
    else if (result.error) { setFailure({ scope: shares.scope, message: result.uncertain ? t.crmWidgets.review.uncertain : result.error.code === "CRM_SHARE_EXPIRY_INVALID" ? t.crmWidgets.review.expiryInvalid : t.crmDashboards.errors[result.error.code ?? ""] ?? t.crmDashboards.actionFailed }); toast.outcomeFromApi(result.error); }
  };
  return { ...active, guard, expiryError, error: failure?.scope === shares.scope ? failure.message : undefined,
    setTarget: (value?: string) => { if (!shares.isSubmitting) setSelection({ ...active, target: shares.targets.find((target) => target.type + ":" + target.id === value) }); },
    setLevel: (level: ShareAccessLevel) => { if (!shares.isSubmitting) setSelection({ ...active, level }); },
    setExpiry: (expiry: string) => { if (!shares.isSubmitting) { setCheckedAt(Date.now()); setSelection({ ...active, expiry }); } },
    submit: async () => { if (active.target && !expiryError && !shares.blocked) report(await shares.share({ subjectType: active.target.type, subjectId: active.target.id, accessLevel: active.level, expiresAt: active.expiry ? new Date(active.expiry).toISOString() : "" }), t.crmDashboards.shared); },
    revoke: async (id: string) => { if (!shares.blocked) report(await shares.revoke(id), t.crmDashboards.shareRevoked); } };
}
