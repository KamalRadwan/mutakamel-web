"use client";

import { Combobox, ErrorState, Field, PageActions, PermissionGate } from "@/design-system";
import { ALL_PRICE_BOOK_SCOPES, usePriceBookScopeOptions } from "../hooks/usePriceBookScopeOptions";

export function PriceBookScopeBar({ companyOnly = false }: { companyOnly?: boolean } = {}) {
  const scope = usePriceBookScopeOptions();
  const { t } = scope;
  const companyError = !scope.canReadCompanies || scope.companyError?.status === 403
    ? <PermissionGate denied require="org.company.read">{null}</PermissionGate>
    : scope.companyError ? <ErrorState title={t.trade.scopeDirectoryFailed} description={scope.companyError.message} onRetry={scope.retry} retryLabel={t.common.retry} /> : undefined;
  const branchError = !scope.canReadBranches || scope.branchError?.status === 403
    ? <PermissionGate denied require="org.branch.read">{null}</PermissionGate>
    : scope.branchError ? <ErrorState title={t.trade.scopeDirectoryFailed} description={scope.branchError.message} onRetry={scope.retry} retryLabel={t.common.retry} /> : undefined;

  return (
    <PageActions slot="related">
    <div className="flex shrink-0 items-center gap-2" role="group" aria-label={t.trade.scopeTitle}>
      <Field label={t.trade.scopeCompany}>
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
          className="w-56 2xl:w-64"
          popoverClassName="w-80"
          textSize="compact"
          wrapLabels
        />
      </Field>
      {!companyOnly ? <Field label={t.trade.scopeBranch}>
        <Combobox
          key={scope.context.companyId ?? ALL_PRICE_BOOK_SCOPES}
          value={scope.context.branchId ?? ALL_PRICE_BOOK_SCOPES}
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
          className="w-56 2xl:w-64"
          popoverClassName="w-80"
          textSize="compact"
          wrapLabels
        />
      </Field> : null}
      {!companyOnly ? <Field label={t.trade.scopeChannel}>
        <Combobox
          key={scope.context.companyId ?? ALL_PRICE_BOOK_SCOPES}
          value={scope.context.channelId ?? ALL_PRICE_BOOK_SCOPES}
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
          errorContent={scope.channelsError?.status === 403 ? (
            <PermissionGate denied require="trade.items.read">{null}</PermissionGate>
          ) : scope.channelsError ? (
            <ErrorState title={t.trade.scopeDirectoryFailed} description={scope.channelsError.message} onRetry={scope.refreshChannels} retryLabel={t.common.retry} />
          ) : undefined}
          disabled={!scope.context.companyId}
          className="w-56 2xl:w-64"
          popoverClassName="w-80"
          textSize="compact"
          wrapLabels
        />
      </Field> : null}
    </div>
    </PageActions>
  );
}
