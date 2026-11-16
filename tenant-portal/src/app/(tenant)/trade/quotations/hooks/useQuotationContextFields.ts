"use client";

import { useI18n } from "@/i18n/I18nContext";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";
import { CHANNEL_SCOPE_HEADER } from "../../trade-api";
import { useTradeChannelChoices } from "../../hooks/useTradeChannelChoices";
import { useTradeScope } from "../../useTradeScope";
import type { QuotationComposerState } from "./useQuotationComposer";

export const NO_QUOTATION_CHANNEL = "__none__";

export function useQuotationContextFields(composer: QuotationComposerState) {
  const { t } = useI18n();
  const scope = useTradeScope();
  const lockedHeaders = composer.lockedHeaders;
  const pinnedCompanyId = lockedHeaders?.[COMPANY_SCOPE_HEADER];
  const pinnedBranchId = lockedHeaders?.[BRANCH_SCOPE_HEADER];
  const pinnedChannelId = lockedHeaders ? (lockedHeaders[CHANNEL_SCOPE_HEADER] ?? undefined) : undefined;

  const companyLookupIds = pinnedCompanyId && !scope.companyIds.includes(pinnedCompanyId)
    ? [...scope.companyIds, pinnedCompanyId]
    : scope.companyIds;
  const branchLookupIds = pinnedBranchId && !scope.branchIds.includes(pinnedBranchId)
    ? [...scope.branchIds, pinnedBranchId]
    : scope.branchIds;

  const companies = useTenantOrganizationOptions("company", companyLookupIds);
  const branches = useTenantOrganizationOptions("branch", branchLookupIds);
  const { context } = scope;
  const companyId = pinnedCompanyId ?? context.companyId ?? (scope.companyIds.length === 1 ? scope.companyIds[0] : undefined);
  const branchId = pinnedBranchId ?? context.branchId ?? (scope.branchIds.length === 1 ? scope.branchIds[0] : undefined);
  const activeChannelId = lockedHeaders ? pinnedChannelId : context.channelId;

  // The provider validates channels against its own branch. With a sole-branch fallback the provider branch is
  // still null, so validate against the effective branch with one dedicated request; otherwise request nothing.
  const needsBranchFallback = !lockedHeaders && !context.branchId && Boolean(companyId && branchId);
  const fallbackChoices = useTradeChannelChoices(needsBranchFallback ? (companyId ?? null) : null,
    needsBranchFallback ? (branchId ?? null) : null);
  const channelSource = needsBranchFallback ? fallbackChoices : scope;
  const unavailableLabel = t.quotationFlow.channelUnavailableForBranch;
  const channels = [{ value: NO_QUOTATION_CHANNEL, label: t.trade.scopeNoChannel, disabled: false },
    ...channelSource.channels.map((channel) => ({ value: channel.id, label: channel.name, disabled: false })),
    ...(channelSource.unavailableChannels ?? []).map((channel) => ({ value: channel.id,
      label: unavailableLabel ? `${channel.name} — ${unavailableLabel}` : channel.name, disabled: true }))];
  const pending = composer.scopeChangePending;
  const resolvedChannelLabel = activeChannelId
    ? (channels.find((item) => item.value === activeChannelId)?.label ?? activeChannelId)
    : t.trade.scopeNoChannel;
  const currentContext = [
    companies.find((item) => item.value === companyId)?.label ?? companyId,
    branches.find((item) => item.value === branchId)?.label ?? branchId,
    resolvedChannelLabel,
  ].filter(Boolean).join(" · ");
  const organizationLabel = (options: readonly { value: string; label: string; resolved?: boolean }[], id: string | null | undefined) => {
    const option = options.find((item) => item.value === id);
    return option && option.resolved !== false ? option.label : t.common.nameUnavailable;
  };
  // Company and branch changes clear what depends on them in the provider, so the inline review shows that
  // resulting context rather than the bare picked name. A company change leaves the branch to be re-chosen.
  const requestedContext = pending?.kind === "context" ? pending.label
    : pending?.kind === "company" ? [organizationLabel(companies, pending.value), t.quotationFlow.chooseBranch, t.trade.scopeNoChannel].join(" · ")
    : pending?.kind === "branch" ? [organizationLabel(companies, companyId), organizationLabel(branches, pending.value), t.trade.scopeNoChannel].join(" · ")
      : pending?.kind === "channel" ? channels.find((item) => item.value === (pending.value ?? NO_QUOTATION_CHANNEL))?.label
        : t.quotationFlow.leaveTitle;

  // Sole-branch fallback only: the provider cannot validate a channel against a branch it does not hold, so the
  // choice goes through the guarded context change with the verified effective branch. Nothing is sent while the
  // branch or channel lookup is loading or failed.
  const fallbackReady = needsBranchFallback && Boolean(companyId && branchId) && !scope.isLoadingBranches
    && !scope.branchesError && !fallbackChoices.isLoadingChannels && !fallbackChoices.channelsError;
  const selectChannel = (next: string | null) => {
    if (!needsBranchFallback) { scope.selectChannel(next); return; }
    const choice = next ? fallbackChoices.channels.find((channel) => channel.id === next) : undefined;
    if (!fallbackReady || !companyId || !branchId || (next && !choice)) return;
    scope.selectContext({ companyId, branchId, channelId: next }, [organizationLabel(companies, companyId),
      organizationLabel(branches, branchId), choice?.name ?? t.trade.scopeNoChannel].join(" · "));
  };
  return {
    t, scope, companies, branches, channels, companyId, branchId, activeChannelId,
    currentContext, requestedContext, selectChannel, channelChoiceReady: !needsBranchFallback || fallbackReady,
    channelsLoading: channelSource.isLoadingChannels, channelsError: channelSource.channelsError,
    refreshChannels: channelSource.refreshChannels, scopeChangeBusy: Boolean(pending) || composer.isChangingScope,
    locked: Boolean(lockedHeaders || scope.contextLocked || composer.write.isBlocked
      || composer.savingStep !== "idle"),
    isNavigation: pending?.kind === "navigate",
  };
}
