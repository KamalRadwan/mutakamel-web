"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Button,
  DateTime,
  ErrorState,
  PageHeader,
  PermissionGate,
  Skeleton,
  SubNav,
  NAV_SECTIONS,
  ToggleGroup,
  ToggleGroupItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { PREBUILT_REPORTS, type PrebuiltReportKey } from "../prebuilt-contract";
import { PrebuiltWidgetCard } from "./components/PrebuiltWidgetCard";
import { usePrebuiltReport } from "./hooks/usePrebuiltReport";

const CRM_ANALYTICS_ITEMS =
  NAV_SECTIONS.find((section) => section.id === "crmAnalytics")?.items ?? [];

export default function PrebuiltReportsPage() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const [reportKey, setReportKey] = useState<PrebuiltReportKey>("overview");
  const { result, isLoading, error, reload } = usePrebuiltReport(reportKey, branchId);

  const report = PREBUILT_REPORTS.find((candidate) => candidate.key === reportKey);

  return (
    <PermissionGate require="crm.dashboards.read" scoped>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmDashboardReports.title}
          description={t.crmDashboardReports.subtitle}
          secondaryActions={
            <>
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
                disabled={isLoading}
              />
              <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
                <RefreshCw
                  className={isLoading ? "size-4 animate-spin" : "size-4"}
                  aria-hidden="true"
                />
                {t.common.retry}
              </Button>
            </>
          }
        />

        <SubNav items={CRM_ANALYTICS_ITEMS} />

        {/* Seven fixed reports, seven routes. They are a ToggleGroup rather
            than seven sidebar rows because they share a permission, a filter
            set and a screen — only the route changes. */}
        <ToggleGroup
          type="single"
          value={reportKey}
          onValueChange={(next) => {
            if (next) setReportKey(next as PrebuiltReportKey);
          }}
          aria-label={t.crmDashboardReports.reportSelector}
          className="flex-wrap"
        >
          {PREBUILT_REPORTS.map((candidate) => (
            <ToggleGroupItem key={candidate.key} value={candidate.key}>
              {t.crmDashboardReports.reports[candidate.key]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {result ? (
          <p className="text-2xs text-muted-foreground">
            {t.crmDashboardReports.generatedAt} <DateTime value={result.generatedAt} />
          </p>
        ) : null}

        {error ? (
          <ErrorState
            title={t.crmDashboardReports.loadFailed}
            description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
            onRetry={() => void reload()}
            retryLabel={t.common.retry}
          />
        ) : null}

        {isLoading && !result ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}

        {result && report ? (
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
