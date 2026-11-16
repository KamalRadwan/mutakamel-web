"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  Button,
  DateTime,
  ErrorState,
  hasPermission,
  PageHeader,
  PermissionGate,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { PREBUILT_REPORTS, type PrebuiltReportKey } from "../prebuilt-contract";
import { PrebuiltWidgetCard } from "./components/PrebuiltWidgetCard";
import { LeadBranchCohortReport } from "./components/LeadBranchCohortReport";
import { LeadConversionJourneyReport } from "./components/LeadConversionJourneyReport";
import { WonCycleReport } from "./components/WonCycleReport";
import { TeamCohortReport } from "./components/TeamCohortReport";
import { WonTargetAttainmentReport } from "./components/WonTargetAttainmentReport";
import { LeadAcquisitionReport } from "./components/LeadAcquisitionReport";
import { LeadSourceMixReport } from "./components/LeadSourceMixReport";
import { InquiryQualityReport } from "./components/InquiryQualityReport";
import { LeadIntakeAllocationReport } from "./components/LeadIntakeAllocationReport";
import { LeadLifecycleReport } from "./components/LeadLifecycleReport";
import { usePrebuiltReport } from "./hooks/usePrebuiltReport";
import { InquiryReviewAction } from "./inquiry-review/InquiryReviewAction";

const DEDICATED_REPORTS = ["lead-acquisition", "lead-sources", "inquiry-quality", "lead-intake-allocation", "lead-lifecycle", "branch-cohort", "conversion-journey", "won-cycle", "team-cohort", "won-target"] as const;
type ReportKey = PrebuiltReportKey | (typeof DEDICATED_REPORTS)[number];

function isReportKey(value: string | null): value is ReportKey {
  return PREBUILT_REPORTS.some(({ key }) => key === value) || DEDICATED_REPORTS.some(key => key === value);
}

export default function PrebuiltReportsPage() {
  return <Suspense fallback={<Skeleton className="h-64" />}><ReportsExplorer /></Suspense>;
}

function ReportsExplorer() {
  const { t } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const enabled = Boolean(user?.isTenantOwner) ||
    hasPermission(user?.permissions ?? [], "crm.dashboards.read", true);
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const searchParams = useSearchParams();
  const requested = searchParams.get("report");
  const reportKey = isReportKey(requested) ? requested : "overview";
  const scopeKey = useAuthScopeKey(user);
  const actorKey = `${realtimeAuthGeneration}:${user?.isTenantOwner}:${scopeKey}`;
  const acquisition = reportKey === "lead-acquisition";
  const sourceMix = reportKey === "lead-sources";
  const inquiryQuality = reportKey === "inquiry-quality";
  const intakeAllocation = reportKey === "lead-intake-allocation";
  const branchCohort = reportKey === "branch-cohort";
  const conversionJourney = reportKey === "conversion-journey";
  const wonCycle = reportKey === "won-cycle";
  const teamCohort = reportKey === "team-cohort";
  const wonTarget = reportKey === "won-target";
  const report = PREBUILT_REPORTS.find((candidate) => candidate.key === reportKey);
  const dedicated = !report;
  const { result, isLoading, error, reload } = usePrebuiltReport(report?.key ?? "overview", branchId, enabled && !dedicated);
  const reportOptions = [
    ...PREBUILT_REPORTS.map(({ key }) => ({ key, label: t.crmDashboardReports.reports[key] })),
    { key: "lead-acquisition", label: t.crmDashboardReports.acquisition.tab },
    { key: "lead-sources", label: t.crmDashboardReports.sourceMix.tab },
    { key: "inquiry-quality", label: t.crmDashboardReports.inquiryQuality.tab },
    { key: "lead-intake-allocation", label: t.crmDashboardReports.intakeAllocation.tab },
    { key: "lead-lifecycle", label: t.crmDashboardReports.leadLifecycle.tab },
    { key: "branch-cohort", label: t.crmDashboardReports.branchCohort.tab },
    { key: "conversion-journey", label: t.crmDashboardReports.conversionJourney.tab },
    { key: "won-cycle", label: t.crmDashboardReports.wonCycle.tab },
    { key: "team-cohort", label: t.crmDashboardReports.teamCohort.tab },
    { key: "won-target", label: t.crmDashboardReports.wonTarget.tab },
  ];
  function selectReport(next: string) {
    if (!isReportKey(next) || next === reportKey) return;
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("report");
    else url.searchParams.set("report", next);
    window.history.pushState(null, "", url);
  }

  return (
    <PermissionGate require={user?.isTenantOwner ? [] : "crm.dashboards.read"} scoped>
      <div className="flex flex-col gap-4 px-1 pb-6 sm:px-3">
        <PageHeader
          title={t.crmDashboardReports.title}
          description={t.crmDashboardReports.subtitle}
          secondaryActions={<>
            <InquiryReviewAction />
            {!dedicated && <>
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
                disabled={isLoading}
              />
              <Button size="xl" variant="outline" onClick={() => void reload()} disabled={isLoading}>
                <RefreshCw
                  className={isLoading ? "size-4 animate-spin" : "size-4"}
                  aria-hidden="true"
                />
                {t.common.retry}
              </Button>
            </>}
          </>}
        />

        <div className="sm:hidden">
          <Select value={reportKey} onValueChange={selectReport}>
            <SelectTrigger size="xl" aria-label={t.crmDashboardReports.reportSelector} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reportOptions.map(({ key, label }) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ToggleGroup
          type="single"
          value={reportKey}
          onValueChange={selectReport}
          aria-label={t.crmDashboardReports.reportSelector}
          className="hidden flex-wrap rounded-lg border border-border bg-card p-3 sm:flex"
        >
          {reportOptions.map(({ key, label }) => <ToggleGroupItem key={key} value={key}>{label}</ToggleGroupItem>)}
        </ToggleGroup>

        {acquisition && enabled && <LeadAcquisitionReport key={actorKey} />}
        {sourceMix && enabled && <LeadSourceMixReport key={actorKey} />}
        {inquiryQuality && enabled && <InquiryQualityReport key={actorKey} />}
        {intakeAllocation && enabled && <LeadIntakeAllocationReport key={actorKey} />}
        {reportKey === "lead-lifecycle" && enabled && <LeadLifecycleReport key={actorKey} />}
        {branchCohort && enabled && <LeadBranchCohortReport key={actorKey} />}
        {conversionJourney && enabled && <LeadConversionJourneyReport key={actorKey} />}
        {wonCycle && enabled && <WonCycleReport key={actorKey} />}
        {teamCohort && enabled && <TeamCohortReport key={actorKey} />}
        {wonTarget && enabled && <PermissionGate require={user?.isTenantOwner ? [] : "crm.targets.read"} scoped>
          <WonTargetAttainmentReport key={actorKey} />
        </PermissionGate>}

        {!dedicated && result ? (
          <p className="text-2xs text-muted-foreground">
            {t.crmDashboardReports.generatedAt} <DateTime value={result.generatedAt} />
          </p>
        ) : null}

        {!dedicated && error ? (
          <ErrorState
            title={t.crmDashboardReports.loadFailed}
            description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
            onRetry={() => void reload()}
            retryLabel={t.common.retry}
          />
        ) : null}

        {!dedicated && isLoading && !result ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}

        {!dedicated && result && report ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.widgets.map((spec) => (
              <PrebuiltWidgetCard
                key={spec.key}
                spec={spec}
                value={result.widgets[spec.key] ?? { kind: "UNAVAILABLE" }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </PermissionGate>
  );
}
