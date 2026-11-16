"use client";

import { Building2 } from "lucide-react";
import { Combobox, ErrorState, Field, PermissionGate } from "@/design-system";
import {
  ALL_PRICING_SCOPES,
  type usePricingScopeOptions,
} from "../hooks/usePricingScopeOptions";

interface PricingScopeBarProps {
  scope: ReturnType<typeof usePricingScopeOptions>;
}

export function PricingScopeBar({ scope }: PricingScopeBarProps) {
  const { t } = scope;

  const companyError =
    !scope.canReadCompanies || scope.companyError?.status === 403 ? (
      <PermissionGate denied require="org.company.read">
        {null}
      </PermissionGate>
    ) : scope.companyError ? (
      <ErrorState
        title={t.trade.scopeDirectoryFailed}
        description={scope.companyError.message}
        onRetry={scope.retry}
        retryLabel={t.common.retry}
      />
    ) : undefined;

  const branchError =
    !scope.canReadBranches || scope.branchError?.status === 403 ? (
      <PermissionGate denied require="org.branch.read">
        {null}
      </PermissionGate>
    ) : scope.branchError ? (
      <ErrorState
        title={t.trade.scopeDirectoryFailed}
        description={scope.branchError.message}
        onRetry={scope.retry}
        retryLabel={t.common.retry}
      />
    ) : undefined;

  const channelError =
    scope.channelsError?.status === 403 ? (
      <PermissionGate denied require="trade.items.read">
        {null}
      </PermissionGate>
    ) : scope.channelsError ? (
      <ErrorState
        title={t.trade.scopeDirectoryFailed}
        description={scope.channelsError.message}
        onRetry={scope.refreshChannels}
        retryLabel={t.common.retry}
      />
    ) : undefined;

  return (
    <section
      aria-label={t.tradePricing.evalScopeAppliedLabel}
      className="flex flex-col gap-3 rounded-column border border-line-card bg-card px-4 py-3 shadow-column lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground lg:pb-1.5">
        <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{t.tradePricing.evalScopeAppliedLabel}</span>
      </div>

      <div
        role="group"
        aria-label={t.trade.scopeTitle}
        className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3 lg:max-w-3xl"
      >
        <Field label={t.trade.scopeCompany} showLabel required>
          <Combobox
            value={scope.context.companyId ?? undefined}
            selectedLabel={scope.companyLabel}
            onValueChange={scope.changeCompany}
            options={scope.companyOptions}
            onSearch={scope.setCompanySearch}
            debounceMs={0}
            loading={scope.isLoading}
            placeholder={t.trade.scopeSelectCompany}
            searchPlaceholder={t.trade.scopeSearchCompanies}
            loadingLabel={t.common.loading}
            emptyLabel={t.common.noData}
            errorContent={companyError}
            popoverClassName="w-80"
            textSize="compact"
            wrapLabels
          />
        </Field>

        <Field label={t.trade.scopeBranch} showLabel>
          <Combobox
            key={`pricing-branch-${scope.context.companyId ?? ALL_PRICING_SCOPES}`}
            value={scope.context.branchId ?? ALL_PRICING_SCOPES}
            selectedLabel={scope.branchLabel}
            onValueChange={scope.changeBranch}
            options={scope.branchOptions}
            onSearch={scope.setBranchSearch}
            debounceMs={0}
            loading={scope.isLoading}
            placeholder={t.trade.scopeAllBranches}
            searchPlaceholder={t.trade.scopeSearchBranches}
            loadingLabel={t.common.loading}
            emptyLabel={t.common.noData}
            errorContent={branchError}
            disabled={!scope.context.companyId}
            popoverClassName="w-80"
            textSize="compact"
            wrapLabels
          />
        </Field>

        <Field label={t.trade.scopeChannel} showLabel>
          <Combobox
            key={`pricing-channel-${scope.context.companyId ?? ALL_PRICING_SCOPES}`}
            value={scope.context.channelId ?? ALL_PRICING_SCOPES}
            selectedLabel={scope.channelLabel}
            onValueChange={scope.changeChannel}
            options={scope.channelOptions}
            onSearch={scope.setChannelSearch}
            debounceMs={0}
            loading={scope.isLoadingChannels}
            placeholder={t.trade.scopeAllChannels}
            searchPlaceholder={t.trade.scopeSearchChannels}
            loadingLabel={t.common.loading}
            emptyLabel={t.common.noData}
            errorContent={channelError}
            disabled={!scope.context.companyId}
            popoverClassName="w-80"
            textSize="compact"
            wrapLabels
          />
        </Field>
      </div>
    </section>
  );
}
