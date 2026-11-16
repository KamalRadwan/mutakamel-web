"use client";
import { Badge, Button, Combobox, ConfirmActionModal, DateTime, DegradedBanner, ErrorState, Field, Input, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { SHARE_ACCESS_LEVELS, type ShareAccessLevel } from "../../../dashboards/share-contract";
import type { useWidgetShareGrants } from "../hooks/useWidgetShareGrants";
import { useWidgetSharingForm } from "../hooks/useWidgetSharingForm";
import { WidgetSelect } from "../../components/WidgetSelect";

export function WidgetSharesSection({ state }: { state: ReturnType<typeof useWidgetShareGrants> }) {
  const { t } = useI18n();
  const labels = t.crmWidgets.review;
  const form = useWidgetSharingForm(state);
  return <section className="space-y-3 rounded-lg border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">{t.crmWidgets.sharesTitle}</h2><p className="text-xs text-muted-foreground">{t.crmWidgets.sharesDescription}</p>
    {state.error && <ErrorState title={labels.sharesFailed} description={t.crmDashboards.errors[state.error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={() => void state.reload()} retryLabel={t.common.retry} />}
    {state.needsReview && <div className="space-y-2"><DegradedBanner message={labels.uncertain} /><div className="flex gap-2">
      <Button variant="outline" disabled={state.isSubmitting} onClick={() => void state.reload()}>{labels.checkCurrent}</Button>
      <Button variant="outline" disabled={!state.reviewReady || state.isSubmitting} onClick={state.review}>{labels.reviewed}</Button></div></div>}
    <div className="grid items-end gap-3 md:grid-cols-2">
      <Field showLabel label={t.crmDashboards.shareTarget}>
        <Combobox value={form.target ? form.target.type + ":" + form.target.id : undefined} selectedLabel={form.target?.name}
          options={state.targets.map((target) => ({ value: target.type + ":" + target.id, label: target.name, description: t.crmDashboards.subjectTypes[target.type] }))}
          onValueChange={form.setTarget} onSearch={(query) => void state.searchTargets(query)} loading={state.targetsLoading}
          disabled={state.isSubmitting || state.blocked} placeholder={t.crmDashboards.shareTargetPlaceholder} searchPlaceholder={t.crmDashboards.shareTargetSearch}
          loadingLabel={t.common.loading} emptyLabel={t.crmDashboards.shareTargetEmpty}
          errorContent={state.targetsError ? <div className="space-y-2"><p className="text-xs text-negative-700">{labels.targetsFailed}</p><Button variant="outline" onClick={() => void state.searchTargets(state.targetsQuery)}>{t.common.retry}</Button></div> : undefined}
          footer={state.targetsHasMore ? <Button variant="outline" disabled={state.targetsLoading} onClick={() => void state.targetsMore()}>{labels.moreTargets}</Button> : undefined} />
      </Field>
      <WidgetSelect label={t.crmDashboards.shareAccessLevel} value={form.level} options={SHARE_ACCESS_LEVELS.map((value) => ({ value, label: t.crmDashboards.shareAccessLevels[value] }))}
        disabled={state.isSubmitting || state.blocked} onChange={(value) => form.setLevel(value as ShareAccessLevel)} />
      <Field showLabel label={labels.expiry} hint={labels.expiryHint} error={form.expiryError}><Input type="datetime-local" value={form.expiry}
        disabled={state.isSubmitting || state.blocked} onChange={(event) => form.setExpiry(event.target.value)} /></Field>
      <Button variant="outline" className="mb-1 justify-self-start" loading={state.isSubmitting} disabled={!form.target || !!form.expiryError || state.blocked}
        onClick={() => void form.submit()}>{t.crmDashboards.shareSubmit}</Button>
    </div>
    {form.error && <p role="alert" className="text-sm text-negative-700">{form.error}</p>}
    {state.isLoading ? <Skeleton className="h-24 w-full" /> : !state.error && !state.shares.length ? <p className="text-xs text-muted-foreground">{t.crmDashboards.noShares}</p> : null}
    <ul className="space-y-2">{state.shares.map((share) => <li key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
      <div><p className="text-sm">{share.subjectName ?? share.subjectEmail ?? labels.selectedUnavailable}</p>
        <p className="text-xs text-muted-foreground">{t.crmDashboards.subjectTypes[share.subjectType]}{share.expiresAt ? <><span> · </span><DateTime value={share.expiresAt} /></> : null}</p></div>
      <div className="flex items-center gap-2"><Badge tone="neutral">{t.crmDashboards.shareAccessLevels[share.accessLevel]}</Badge>
        <Button variant="ghost" disabled={state.blocked || state.isSubmitting} onClick={() => void form.revoke(share.id)}>{t.crmDashboards.revokeShare}</Button></div>
    </li>)}</ul>
    <ConfirmActionModal open={form.guard.isDiscardOpen} onOpenChange={(open) => { if (!open) form.guard.cancelDiscard(); }}
      title={t.common.discardTitle} description={t.common.discardDescription} confirmLabel={t.common.discardConfirm} cancelLabel={t.common.cancel} onConfirm={form.guard.confirmDiscard} />
  </section>;
}

