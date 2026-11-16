"use client";

import { Button, DegradedBanner, Field, NameSelect } from "@/design-system";
import { TenantOrganizationSelect } from "@/components/tenant/TenantOrganizationSelect";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeScope } from "./useTradeScope";

const CLEAR_VALUE = "__all__";

/** Identifiers stay in operating-context values; all three pickers show names. */
export function TradeScopeBar({ allowItemMaster = false, hideWhenSingleScope = false }: {
  allowItemMaster?: boolean;
  hideWhenSingleScope?: boolean;
}) {
  const { t } = useI18n();
  const { context, companyIds, branchIds, channels, isLoadingChannels,
    branchesError, refreshBranches, isLoadingBranches, channelsError, refreshChannels, contextLocked, selectCompany, selectBranch, selectChannel } = useTradeScope();
  const showCompany = !hideWhenSingleScope || companyIds.length > 1;
  const showBranch = !hideWhenSingleScope || branchIds.length > 1;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.trade.scopeTitle}>
      {showCompany && <Field label={t.trade.scopeCompany} hint={companyIds.length === 0 ? t.quotationFlow.noCompanies : undefined} showLabel>
        <TenantOrganizationSelect kind="company" ids={companyIds}
          value={context.companyId ?? (allowItemMaster ? CLEAR_VALUE : undefined)}
          onValueChange={(next) => selectCompany(next === CLEAR_VALUE ? null : next)}
          placeholder={t.trade.scopeSelectCompany} disabled={contextLocked || companyIds.length === 0} className="w-56"
          allOption={allowItemMaster ? { value: CLEAR_VALUE, label: t.trade.scopeItemMaster } : undefined} />
      </Field>}
      {showBranch && <Field label={t.trade.scopeBranch} hint={isLoadingBranches ? t.common.loading : context.companyId && branchIds.length === 0 && !branchesError ? t.quotationFlow.noBranches : undefined} showLabel>
        <TenantOrganizationSelect kind="branch" ids={branchIds} value={context.branchId ?? CLEAR_VALUE}
          onValueChange={(next) => selectBranch(next === CLEAR_VALUE ? null : next)}
          disabled={contextLocked || !context.companyId || branchIds.length === 0} placeholder={t.trade.scopeAllBranches}
          className="w-56" allOption={{ value: CLEAR_VALUE, label: t.trade.scopeAllBranches }} />
      </Field>}
      <Field label={t.trade.scopeChannel} showLabel>
        <NameSelect value={context.channelId ?? CLEAR_VALUE}
          options={[{ value: CLEAR_VALUE, label: t.trade.scopeNoChannel },
            ...channels.map((channel) => ({ value: channel.id, label: channel.name }))]}
          onValueChange={(next) => selectChannel(next === CLEAR_VALUE ? null : next)}
          disabled={contextLocked || !context.companyId || isLoadingChannels}
          placeholder={t.trade.scopeNoChannel} searchPlaceholder={t.trade.scopeSearchChannels} className="w-56" />
      </Field>
      {branchesError ? <div className="flex w-full flex-wrap items-center gap-2"><DegradedBanner message={t.quotationFlow.branchesUnavailable} /><Button variant="outline" size="xs" loading={isLoadingBranches} onClick={refreshBranches}>{t.common.retry}</Button></div> : null}
      {channelsError ? <div className="flex w-full flex-wrap items-center gap-2"><DegradedBanner message={t.quotationFlow.channelsUnavailable} /><Button variant="outline" size="xs" loading={isLoadingChannels} onClick={refreshChannels}>{t.common.retry}</Button></div> : null}
    </div>
  );
}
