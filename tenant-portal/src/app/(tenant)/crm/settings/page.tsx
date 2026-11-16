"use client";

import { RotateCw, Save } from "lucide-react";
import { Button, Card, CardContent, ConfirmActionModal, DegradedBanner, ErrorState,
  PageHeader, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmSettingsView } from "./hooks/useCrmSettingsView";
import { useCrmSettingsNames } from "./hooks/useCrmSettingsNames";
import { CrmSettingsCards } from "./components/CrmSettingsCards";
import { TelephonyDrawer } from "./components/TelephonyDrawer";

export default function CrmSettingsPage() {
  const { t } = useI18n();
  const s = t.crmSettings;
  const model = useCrmSettingsView();
  const { pipelineName } = useCrmSettingsNames(null, model.settings?.defaultPipelineId);
  const blocked = model.isSaving || model.isLoading;
  return (
    <PermissionGate require="crm.settings.read" denied={model.queryError?.status === 403}>
      <div className="flex flex-col gap-4">
        <PageHeader title={t.nav.crmSettings} description={s.description}
          primaryAction={model.settings ? { label: s.save, icon: <Save className="size-4" aria-hidden="true" />,
            onClick: () => void model.saveSettings(), loading: model.isSaving,
            disabled: !model.canManage || !model.isDirty || blocked || model.hasRetentionConflict || model.needsReview || Object.keys(model.errors).length > 0 } : undefined}
          secondaryActions={model.settings && <Button variant="outline" size="sm" onClick={model.reload} disabled={blocked || model.needsReview || model.hasRetentionConflict}><RotateCw className="size-4" aria-hidden="true" />{s.retry}</Button>} />

        {model.settings && model.draft && (model.error || model.hasRetentionConflict || model.needsReview) && (
          <div role="alert" className="space-y-3 rounded-lg border border-caution-200 bg-caution-100 p-3 text-sm text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300">
            <p>{model.hasRetentionConflict ? s.retentionConflict : model.error}</p>
            {model.hasRetentionConflict && model.error && <p>{model.error}</p>}
            <div className="flex flex-wrap gap-2">
              {model.hasRetentionConflict && <Button variant="outline" size="sm" onClick={() => void model.reloadRetentionPolicy()} disabled={blocked}>{s.reloadRetentionPolicy}</Button>}
              {model.needsReview && <>
                <Button variant="outline" size="sm" onClick={() => void model.fetchSettings(undefined, true)} disabled={blocked}>{s.reloadCurrent}</Button>
                <Button variant="outline" size="sm" onClick={model.acknowledgeReview} disabled={!model.reviewReady || blocked}>{s.reviewAcknowledged}</Button>
              </>}
              {!model.needsReview && !model.hasRetentionConflict && <Button variant="outline" size="sm" onClick={() => void model.fetchSettings(undefined, true)} disabled={blocked}>{s.retry}</Button>}
            </div>
          </div>
        )}
        {!model.canManage && model.settings && <DegradedBanner message={s.readOnly} />}
        {model.isLoading && !model.settings ? (
          <div aria-label={s.loading} aria-busy="true" className="grid gap-4 xl:grid-cols-3">
            {[0, 1, 2].map((key) => <Card key={key}><CardContent className="space-y-4 p-4"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-9 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>)}
          </div>
        ) : !model.settings || !model.draft ? (
          <div role="alert"><ErrorState title={s.unavailable} description={model.queryError?.code === "CRM_SETTINGS_MISSING" ? s.missingSettings : model.error ?? undefined} onRetry={() => void model.fetchSettings()} retryLabel={s.retry} /></div>
        ) : <CrmSettingsCards model={model} pipelineName={pipelineName} />}
        <TelephonyDrawer model={model} />
        <ConfirmActionModal open={model.guard.isDiscardOpen} onOpenChange={(open) => { if (!open) model.guard.cancelDiscard(); }}
          title={s.discardTitle} description={s.discardDescription} confirmLabel={s.reset} cancelLabel={s.keepEditing}
          onConfirm={model.guard.confirmDiscard} loading={model.isSaving} />
      </div>
    </PermissionGate>
  );
}
