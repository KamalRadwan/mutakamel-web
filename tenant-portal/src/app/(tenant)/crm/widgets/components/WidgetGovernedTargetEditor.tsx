"use client";

import { useEffect, useState } from "react";
import { Button, Combobox, Field, hasPermission } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { resolveDefaultTenantBranchId } from "@/hooks/useTenantBranchSelection";
import { useTenantBranchSelect } from "@/hooks/useTenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { can } from "@/lib/auth/permission-scope";
import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, record } from "../../dashboards/dashboard-parse";
import { alignedTargetPeriod, expectedTargetPeriodEnd, isGovernedTargetBinding, TARGET_GRAINS, TARGET_SUBJECTS,
  type GovernedTargetBinding } from "../../dashboards/won-target-evidence";
import type { useWidgetForm } from "../hooks/useWidgetForm";
import { WIDGET_READ } from "../hooks/widget-requests";
import { WidgetSelect } from "./WidgetSelect";

const METRIC = "crm.opportunities.won.estimated_value";
const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;
type TargetOption = { id: string; binding: GovernedTargetBinding; periodStart: string; periodEndExclusive: string; subjectName: string | null };

function inclusiveEnd(exclusiveEnd: string) {
  return new Date(Date.parse(`${exclusiveEnd}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

function parseTargetOptions(value: unknown, branchId: string, grain: GovernedTargetBinding["periodGrain"], page: number) {
  const result = record(value);
  if (!result || result.page !== page || result.limit !== PAGE_SIZE || typeof result.hasNext !== "boolean"
    || !boundedArray(result.items, PAGE_SIZE)) return invalidResponse("sales target options");
  const items = result.items.map((value): TargetOption => {
    const row = record(value);
    if (!row) return invalidResponse("sales target option");
    const { id, branchId: optionBranch, subjectType, subjectId, periodGrain, currencyCode, periodStart, periodEndExclusive, subjectName } = row;
    const binding = { branchId: optionBranch, subjectType, subjectId, periodGrain, currencyCode };
    if (!isUUIDv7(id) || !isGovernedTargetBinding(binding) || optionBranch !== branchId || periodGrain !== grain || row.metricKey !== METRIC
      || !alignedTargetPeriod(periodStart, grain) || typeof periodEndExclusive !== "string" || periodEndExclusive !== expectedTargetPeriodEnd(periodStart, grain)
      || (subjectName !== null && typeof subjectName !== "string")) return invalidResponse("sales target option");
    return { id, binding, periodStart, periodEndExclusive, subjectName };
  });
  if (new Set(items.map(({ id }) => id)).size !== items.length) return invalidResponse("sales target options");
  return { items, hasNext: result.hasNext };
}

export function WidgetGovernedTargetEditor({ state }: { state: ReturnType<typeof useWidgetForm> }) {
  const { t } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const authScope = useAuthScopeKey(user);
  const labels = t.crmWidgets.governedTarget;
  const report = t.crmDashboardReports.wonTarget;
  const binding = state.form.governedTarget;
  const canRead = !!user && (user.isTenantOwner || hasPermission(user.permissions, "crm.targets.read", true));
  const targetScope = user?.permissionScopes?.["crm.targets.read"];
  const dashboardScope = user?.permissionScopes?.["crm.dashboards.read"];
  const branchIds = canRead ? user.accessibleBranches.filter(branchId => user.isTenantOwner
    || ((!targetScope || can(user, "crm.targets.read", { branchId })) && (!dashboardScope || can(user, "crm.dashboards.read", { branchId })))) : [];
  const [selectedBranch, setBranch] = useState(binding?.branchId ?? resolveDefaultTenantBranchId(user));
  const [grain, setGrain] = useState<GovernedTargetBinding["periodGrain"]>(binding?.periodGrain ?? "MONTH");
  const [subject, setSubject] = useState(binding?.subjectType ?? "ALL");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [settled, setSettled] = useState<{ key: string; result?: ReturnType<typeof parseTargetOptions> }>();
  const branchId = selectedBranch && branchIds.includes(selectedBranch) ? selectedBranch : null;
  const branch = useTenantBranchSelect({ branchIds, branchId, onChange: value => { setBranch(value); setPage(1); } });
  const path = branchId ? `/api/tenant/crm/v1/targets?${new URLSearchParams({ branchId, metricKey: METRIC, periodGrain: grain,
    ...(subject === "ALL" ? {} : { subjectType: subject }), page: String(page), limit: String(PAGE_SIZE) })}` : null;
  const requestKey = JSON.stringify([authScope, realtimeAuthGeneration ?? null, targetScope ?? null, dashboardScope ?? null, path, retry]);

  useEffect(() => {
    if (!branchId || !path) return;
    const controller = new AbortController();
    async function load(requestPath: string, requestedBranch: string) {
      try {
        const response = await axiosClient.get<unknown>(requestPath, { ...WIDGET_READ, signal: controller.signal });
        if (controller.signal.aborted) return;
        const result = parseTargetOptions(response.data, requestedBranch, grain, page);
        if (subject !== "ALL" && result.items.some(item => item.binding.subjectType !== subject)) return invalidResponse("sales target subject");
        setSettled({ key: requestKey, result });
      } catch {
        if (!controller.signal.aborted) setSettled({ key: requestKey });
      }
    }
    void load(path, branchId);
    return () => controller.abort();
  }, [branchId, grain, page, path, requestKey, subject]);

  const current = settled?.key === requestKey ? settled : undefined;
  const busy = path !== null && current === undefined;
  const items = current?.result?.items ?? [];
  const selectedId = state.form.filters.datePreset === "CUSTOM" ? items.find(item => item.binding.branchId === binding?.branchId && item.binding.subjectType === binding.subjectType
    && item.binding.subjectId === binding.subjectId && item.binding.currencyCode === binding.currencyCode
    && item.binding.periodGrain === binding.periodGrain && item.periodStart === state.form.filters.dateFrom
    && inclusiveEnd(item.periodEndExclusive) === state.form.filters.dateTo)?.id : undefined;
  const select = (id: string) => {
    const option = items.find(item => item.id === id);
    if (!option) return;
    const dateTo = inclusiveEnd(option.periodEndExclusive);
    state.update({ comparison: "GOVERNED_TARGET", governedTarget: option.binding,
      filters: { ...state.form.filters, datePreset: "CUSTOM", dateFrom: option.periodStart, dateTo } });
  };

  return <fieldset className="space-y-3 rounded-lg border border-border bg-muted/20 p-3" aria-busy={busy}>
    <legend className="px-1 text-sm font-medium">{labels.title}</legend>
    <p className="text-xs text-muted-foreground">{labels.hint}</p>
    {!canRead && <p role="note" className="text-xs text-muted-foreground">{labels.denied}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field showLabel label={t.common.branch} required>
        <Combobox value={branch.value} selectedLabel={branch.selectedLabel} onValueChange={branch.change} options={branch.filteredOptions}
          onSearch={branch.search} placeholder={t.common.selectBranch} searchPlaceholder={t.common.searchBranches}
          loadingLabel={t.common.loading} emptyLabel={t.common.noMatchingBranches} disabled={state.disabled || !canRead} />
      </Field>
      <WidgetSelect label={report.grain} value={grain} disabled={state.disabled || !canRead}
        options={TARGET_GRAINS.map(value => ({ value, label: report.grains[value] }))}
        onChange={value => { setGrain(value as typeof grain); setPage(1); }} />
      <WidgetSelect label={report.subjectType} value={subject} disabled={state.disabled || !canRead}
        options={[{ value: "ALL", label: report.allSubjects }, ...TARGET_SUBJECTS.map(value => ({ value, label: report.subjects[value] }))]}
        onChange={value => { setSubject(value as typeof subject); setPage(1); }} />
    </div>
    <WidgetSelect label={labels.target} value={selectedId ?? ""} disabled={state.disabled || items.length === 0}
      placeholder={binding ? labels.saved : labels.select} error={state.touched && state.error === "GOVERNED_TARGET_INVALID" ? t.crmWidgets.formErrors.GOVERNED_TARGET_INVALID : undefined}
      options={items.map(item => ({ value: item.id,
        label: `${item.subjectName ?? report.subjectUnavailable} · ${report.subjects[item.binding.subjectType]} · ${item.binding.currencyCode} · ${item.periodStart}` }))} onChange={select} />
    {binding && <p className="text-xs text-muted-foreground"><bdi>{binding.currencyCode}</bdi> · {report.grains[binding.periodGrain]} · {report.subjects[binding.subjectType]}</p>}
    {busy && <p role="status" className="text-xs text-muted-foreground">{t.common.loading}</p>}
    {current && !current.result && <div className="flex flex-wrap items-center gap-2" role="alert">
      <p className="text-xs text-muted-foreground">{labels.loadFailed}</p>
      <Button type="button" size="sm" variant="outline" disabled={state.disabled} onClick={() => setRetry(value => value + 1)}>{t.common.retry}</Button>
    </div>}
    {current?.result && items.length === 0 && <p role="status" className="text-xs text-muted-foreground">{labels.empty}</p>}
    {(page > 1 || current?.result?.hasNext) && <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={state.disabled || busy || page <= 1} onClick={() => setPage(value => value - 1)}>{t.common.previousPage}</Button>
      <Button type="button" variant="outline" size="sm" disabled={state.disabled || busy || !current?.result?.hasNext} onClick={() => setPage(value => value + 1)}>{t.common.nextPage}</Button>
    </div>}
  </fieldset>;
}
