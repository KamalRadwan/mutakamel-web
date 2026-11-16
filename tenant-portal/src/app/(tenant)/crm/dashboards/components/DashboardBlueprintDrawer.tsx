"use client";

import { useId } from "react";
import { LayoutTemplate } from "lucide-react";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { Badge, Button, Checkbox, DegradedBanner, Field, FormDrawer, Input, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { DASHBOARD_NAME_MAX_LENGTH } from "../dashboard-contract";
import type { useDashboardBlueprints } from "../hooks/useDashboardBlueprints";
import { DashboardRecoveryNotice } from "./DashboardRecoveryNotice";

const REFRESH_REVIEW_ERRORS = new Set([
  "CRM_DASHBOARD_BLUEPRINT_REVISION_CHANGED", "CRM_DASHBOARD_BLUEPRINT_NOT_FOUND",
  "CRM_DASHBOARD_BLUEPRINT_ALREADY_ADOPTED", "CRM_DASHBOARD_BLUEPRINT_ADOPTION_REMOVED",
  "CRM_DASHBOARD_BLUEPRINT_ADOPTION_MISMATCH", "CRM_DASHBOARD_BLUEPRINT_BRANCH_REQUIRED",
]);
const focusHeading = (node: HTMLHeadingElement | null) => { node?.focus(); };

export function DashboardBlueprintDrawer({ state, onRecovery }: { state: ReturnType<typeof useDashboardBlueprints>; onRecovery: () => void }) {
  const { t, lang } = useI18n();
  const copy = t.crmDashboards.blueprints;
  const targetConfirmation = useId();
  const { selected, activeReview: review } = state;
  const frozen = state.busy || state.blocked;
  const error = review?.error ? t.crmDashboards.errors[review.error.code ?? ""] ?? t.crmDashboards.actionFailed : undefined;

  return <FormDrawer open={state.open} onOpenChange={state.changeOpen} title={copy.title} description={copy.description}
    isDirty={Boolean(review?.name || review?.confirmed)} isSubmitting={state.submitting} error={error}
    submitDisabled={!review || !selected || state.loading || frozen || (selected.targets.length > 0 && !review.confirmed)}
    onSubmit={() => void state.adopt()}
    footerLeading={selected ? <Button type="button" variant="ghost" onClick={state.clearReview} disabled={frozen}>{copy.back}</Button> : undefined}
    labels={{ submit: copy.adopt, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
      discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel }}>
    <div className="flex flex-col gap-4 pb-3">
      <DashboardRecoveryNotice blocked={state.blocked} ready={state.reviewReady} busy={state.busy || state.loading}
        onReload={onRecovery} onAcknowledge={state.acknowledge} />
      {selected && review ? <section className="flex flex-col gap-4" aria-label={copy.review}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
          <h3 ref={focusHeading} tabIndex={-1} className="break-words text-base font-semibold" dir="auto">{selected.name}</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge tone="neutral" size="sm">{copy.audiences[selected.audience]}</Badge>
            <span>{formatTemplate(t.crmDashboards.widgetCount, { count: formatNumber(selected.widgetCount, lang) })}</span>
          </div>
          {selected.description && <p className="break-words text-sm text-muted-foreground" dir="auto">{selected.description}</p>}
        </div>
        <Field showLabel label={copy.name} hint={t.crmDashboards.review.nameLimit}>
          <Input value={review.name} maxLength={DASHBOARD_NAME_MAX_LENGTH} disabled={frozen}
            placeholder={selected.name} autoComplete="off" dir="auto" onChange={event => state.updateReview({ name: event.target.value, error: undefined })} />
        </Field>
        {selected.targets.length > 0 && <section className="flex flex-col gap-2 rounded-lg border border-border p-3" aria-label={copy.targets}>
          <h4 className="text-sm font-semibold">{copy.targets}</h4>
          <dl className="divide-y divide-border">
            {selected.targets.map(({ widgetName, target }, index) => <div key={`${widgetName}-${target}-${index}`} className="flex items-start justify-between gap-3 py-2 text-sm">
              <dt className="min-w-0 break-words" dir="auto">{widgetName}</dt><dd className="shrink-0 tabular-nums"><bdi>{formatNumber(target, lang)}</bdi></dd>
            </div>)}
          </dl>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={review.confirmed} onCheckedChange={checked => state.updateReview({ confirmed: checked === true, error: undefined })}
              disabled={frozen} aria-labelledby={targetConfirmation} />
            <span id={targetConfirmation}>{copy.confirmTargets}</span>
          </label>
        </section>}
        {review.error?.code && REFRESH_REVIEW_ERRORS.has(review.error.code) &&
          <Button type="button" variant="outline" className="self-start" disabled={frozen || state.loading}
            onClick={() => { state.clearReview(); void state.reload(); }}>{copy.refresh}</Button>}
      </section> : <>
        <TenantBranchSelect branchIds={state.branchIds} branchId={state.branchId} allowAll onChange={state.selectBranch} disabled={frozen} />
        {state.branchIds.length === 1 && (state.branchId || state.items.some(item => item.adoption.state === "AVAILABLE" && item.branchSelectionRequired)) &&
          <Button type="button" variant="outline" className="self-start" disabled={frozen}
            onClick={() => state.selectBranch(state.branchId ? null : state.branchIds[0] ?? null)}>
            {state.branchId ? t.common.allBranches : t.common.selectBranch}
          </Button>}
        <h3 ref={focusHeading} tabIndex={-1} className="text-base font-semibold">{copy.choices}</h3>
        <PermissionGate require={[]} denied={state.queryError?.status === 403}>
          {state.loading ? <div className="space-y-2" role="status" aria-label={copy.loading}>
            <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
          </div> : state.queryError ? <div className="flex flex-col items-start gap-2">
            <DegradedBanner message={state.queryError.status === 503 ? copy.notReady : copy.failed} />
            <Button type="button" variant="outline" disabled={state.busy} onClick={() => void state.reload()}>{t.common.retry}</Button>
          </div> : state.items.length === 0 ? <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{copy.empty}</p>
          : <ul className="flex flex-col gap-2">
            {state.items.map(item => <li key={item.key}>
              {item.adoption.state === "REMOVED" || item.adoption.state === "ADOPTED_ELSEWHERE"
                || (item.adoption.state === "AVAILABLE" && item.branchSelectionRequired) ? <div className="rounded-lg border border-border bg-muted p-3">
                <p className="break-words text-sm font-medium" dir="auto">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.adoption.state === "REMOVED" ? copy.removed
                  : item.adoption.state === "ADOPTED_ELSEWHERE" ? copy.adoptedElsewhere : copy.branchRequired}</p>
              </div> : <Button type="button" variant="outline" className="h-auto w-full min-w-0 justify-start whitespace-normal px-3 py-3 text-start"
                disabled={frozen} onClick={() => state.choose(item)}>
                <LayoutTemplate className="mt-0.5 size-4 shrink-0 self-start text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="break-words text-sm font-semibold" dir="auto">{item.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">{copy.audiences[item.audience]} · {formatTemplate(t.crmDashboards.widgetCount, { count: formatNumber(item.widgetCount, lang) })}</span>
                  {item.description && <span className="break-words text-sm font-normal text-muted-foreground" dir="auto">{item.description}</span>}
                  {item.adoption.state === "ADOPTED" && <span className="text-sm text-muted-foreground">{copy.openExisting}</span>}
                </span>
              </Button>}
            </li>)}
          </ul>}
        </PermissionGate>
      </>}
    </div>
  </FormDrawer>;
}
