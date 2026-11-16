"use client";

import { Dialog, DialogContent, DialogTitle, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ActivityModal } from "./ActivityModal";
import type { ActivityScope } from "./activity-contract";
import { activityErrorMessage } from "./activity-presentation";
import { useActivityDeepLink } from "./hooks/useActivityDeepLink";

export function ActivityDeepLink({ scope, onChanged }: { scope: ActivityScope; onChanged: () => void }) {
  const { t } = useI18n();
  const { id, authorized, detail, close } = useActivityDeepLink();
  if (!id) return null;
  if (detail.activity) return <ActivityModal request={{ kind: "view", activity: detail.activity }}
    scope={scope} onClose={close} onChanged={onChanged} />;
  return <Dialog open onOpenChange={(next) => { if (!next) close(); }}><DialogContent aria-describedby={undefined}>
    <DialogTitle>{t.activities.title}</DialogTitle>
    {!authorized || detail.error?.status === 403 ? (
      <PermissionGate require="activities.read" denied>{null}</PermissionGate>
    ) : detail.error ? (
      <ErrorState title={activityErrorMessage(t, detail.error) ?? t.activities.workspace.loadFailed} onRetry={detail.reload} retryLabel={t.common.retry} />
    ) : <Skeleton className="h-32 w-full" />}
  </DialogContent></Dialog>;
}
