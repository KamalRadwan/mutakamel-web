"use client";

import { useEffect, useId, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { Button, Card, DateTime, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { buildRunRequest } from "../../dashboard-run-contract";
import { DashboardFilterBar } from "../../[id]/components/DashboardFilterBar";
import { LEAD_INTAKE_ALLOCATION_PATH, parseLeadIntakeAllocation, type IntakeRequest, type LeadIntakeAllocation } from "../lead-intake-allocation-contract";
import { IntakeAllocationCharts, UnassignedIntakeQueue } from "./LeadIntakeAllocationPanels";

const INITIAL: IntakeRequest = {
  selection: { branchId: null, datePreset: null, compare: null, currencyCode: null }, cursors: [null],
};

export function LeadIntakeAllocationReport() {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.intakeAllocation;
  const [request, setRequest] = useState(INITIAL);
  const [settled, setSettled] = useState<{ request: IntakeRequest; result?: LeadIntakeAllocation; error?: NormalizedApiError }>();
  const [organization, setOrganization] = useState<LeadIntakeAllocation["scope"]>();
  const [showMethod, setShowMethod] = useState(false);
  const methodId = useId();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    queueMicrotask(async () => {
      if (signal.aborted) return;
      try {
        const cursor = request.cursors.at(-1);
        const response = await axiosClient.post<unknown>(LEAD_INTAKE_ALLOCATION_PATH, {
          ...buildRunRequest(request.selection),
          ...(request.comparisonOwnerIds ? { comparisonOwnerIds: request.comparisonOwnerIds } : {}),
          ...(request.queuePeriod ? { queuePeriod: { datePreset: "CUSTOM", ...request.queuePeriod } } : {}),
          ...(cursor ? { queueCursor: cursor } : {}),
        }, { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024, skipAutoIdempotency: true, signal });
        if (signal.aborted) return;
        const result = parseLeadIntakeAllocation(response.data, request);
        setOrganization(result.scope);
        setSettled({ request, result });
      } catch (error) {
        if (signal.aborted) return;
        const failure = normalizeApiError(error);
        if (failure.status === 401 || failure.status === 403) setOrganization(undefined);
        setSettled({ request, error: failure });
      }
    });
    return () => controller.abort();
  }, [request]);

  const current = settled?.request === request ? settled : undefined;
  const result = current?.result;
  const error = current?.error;
  const denied = error?.status === 403;
  const reload = () => setRequest(previous => ({ ...previous, cursors: [null], comparisonOwnerIds: undefined }));
  return <section aria-labelledby="intake-allocation-title" aria-busy={!current} className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="intake-allocation-title" className="text-lg font-semibold">{labels.title}</h2>
      {!denied && <div className="flex flex-wrap gap-2">
        <Button size="xl" variant="outline" aria-controls={methodId} aria-expanded={showMethod} onClick={() => setShowMethod(!showMethod)}>
          <Info className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.explain}
        </Button>
        <Button size="xl" variant="outline" disabled={!current} onClick={reload}>
          <RefreshCw className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.runAgain}
        </Button>
      </div>}
    </div>
    <div id={methodId} hidden={!showMethod || denied}>
      <Card className="p-4 text-sm text-muted-foreground">{labels.method}</Card>
    </div>
    {organization && <DashboardFilterBar selection={request.selection} branchIds={[]} organization={organization}
      disabled={!current} currencyCodes={[]} reportDefaultPeriod={t.crmDashboards.datePresets.LAST_MONTH}
      onChange={selection => setRequest(previous => ({ ...previous, selection, comparisonOwnerIds: undefined, cursors: [null] }))} />}
    {denied && <PermissionGate require={[]} denied>{null}</PermissionGate>}
    {error && !denied && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {error && <Button className="self-start" variant="outline" onClick={() => setRequest({ ...INITIAL })}>
      {t.crmDashboardReports.acquisition.resetFilters}
    </Button>}
    {!current && <div role="status"><span className="sr-only">{labels.loading}</span><Skeleton className="h-80" /></div>}
    {result && <>
      <p className="text-xs text-muted-foreground">{t.crmDashboardReports.generatedAt} <DateTime value={result.asOf} timeZone={result.range.timeZone} /></p>
      {result.scope.partialAccess && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.partialAccessNotice}</p>}
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <IntakeAllocationCharts result={result} onCompare={comparisonOwnerIds =>
          setRequest(previous => ({ ...previous, comparisonOwnerIds }))} />
        <UnassignedIntakeQueue result={result} hasPrevious={request.cursors.length > 1}
          onPrevious={() => setRequest(previous => ({ ...previous, cursors: previous.cursors.slice(0, -1) }))}
          onNext={cursor => setRequest(previous => ({ ...previous, cursors: [...previous.cursors, cursor] }))}
          onPeriod={queuePeriod => setRequest(previous => ({ ...previous, queuePeriod, cursors: [null] }))} />
      </div>
    </>}
  </section>;
}
