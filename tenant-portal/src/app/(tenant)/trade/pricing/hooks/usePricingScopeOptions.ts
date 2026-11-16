"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CORE_MAX_PAGE_LIMIT } from "@/app/(tenant)/core/contracts/core-page";
import {
  fetchOrgNodes,
  type Branch,
  type Company,
  type OrgLevel,
  type OrgNodeOf,
} from "@/app/(tenant)/core/contracts/organization-contract";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import type { PricingReferenceBranch } from "../../price-books/pricing-contract";
import { useTradeScope } from "../../useTradeScope";

export const ALL_PRICING_SCOPES = "__all__";

interface ScopeDirectory {
  key: string;
  companies: Company[];
  branches: Branch[];
  companyError: NormalizedApiError | null;
  branchError: NormalizedApiError | null;
}

// Core caps a page at 100. Read every page once so local search covers all
// accessible companies and branches without issuing network requests per keystroke.
async function loadOrgDirectory<L extends OrgLevel>(
  level: L,
  signal: AbortSignal,
): Promise<OrgNodeOf<L>[]> {
  const items: OrgNodeOf<L>[] = [];
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const result = await fetchOrgNodes(level, {
      page,
      limit: CORE_MAX_PAGE_LIMIT,
      search: "",
      signal,
      suppressForbiddenToast: true,
    });
    items.push(...result.items);
    if (!result.hasNext) return items;
    if (result.items.length === 0) {
      throw new Error("Invalid organization pagination.");
    }
  }
}

export function usePricingScopeOptions(options?: {
  referenceBranches?: readonly PricingReferenceBranch[];
  onChannelScopeChange?: () => void;
}) {
  const referenceBranches = options?.referenceBranches;
  const onChannelScopeChange = options?.onChannelScopeChange;
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { t, lang } = useI18n();
  const {
    context,
    companyIds,
    branchIds,
    selectCompany,
    selectBranch,
    channels,
    isLoadingChannels,
    channelsError,
    selectChannel,
    refreshChannels,
  } = useTradeScope();

  const [directory, setDirectory] = useState<ScopeDirectory | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [revision, setRevision] = useState(0);

  const canReadCompanies = Boolean(
    user?.isTenantOwner || can(user, "org.company.read"),
  );
  const canReadBranches = Boolean(
    user?.isTenantOwner || can(user, "org.branch.read"),
  );

  const key = user?.id
    ? JSON.stringify([
        user.id,
        realtimeAuthGeneration,
        canReadCompanies,
        canReadBranches,
        [...companyIds].sort(),
        [...(user.accessibleBranches ?? [])].sort(),
        user.permissionScopes,
      ])
    : null;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void Promise.allSettled([
      canReadCompanies
        ? loadOrgDirectory("companies", controller.signal)
        : Promise.resolve([]),
      canReadBranches
        ? loadOrgDirectory("branches", controller.signal)
        : Promise.resolve([]),
    ]).then(([companiesRes, branchesRes]) => {
      if (controller.signal.aborted) return;
      setDirectory({
        key,
        companies: companiesRes.status === "fulfilled" ? companiesRes.value : [],
        branches: branchesRes.status === "fulfilled" ? branchesRes.value : [],
        companyError:
          companiesRes.status === "rejected"
            ? normalizeApiError(companiesRes.reason)
            : null,
        branchError:
          branchesRes.status === "rejected"
            ? normalizeApiError(branchesRes.reason)
            : null,
      });
    });
    return () => controller.abort();
  }, [key, canReadCompanies, canReadBranches, revision]);

  const settled = key !== null && directory?.key === key ? directory : null;

  const companies = useMemo(
    () =>
      (settled?.companies ?? [])
        .filter((company) => companyIds.includes(company.id))
        .sort((a, b) => a.name.localeCompare(b.name, lang)),
    [settled, companyIds, lang],
  );

  const branches = useMemo(() => {
    const coreBranches = (settled?.branches ?? [])
      .filter(
        (branch) =>
          user?.accessibleBranches.includes(branch.id) &&
          companyIds.includes(branch.companyId) &&
          (!context.companyId || branch.companyId === context.companyId),
      )
      .map((branch) => ({ id: branch.id, name: branch.name }));
    if (coreBranches.length > 0) {
      return coreBranches.sort((a, b) => a.name.localeCompare(b.name, lang));
    }
    // Trade reference-data returns company-scoped branches when `trade.pricing.read` is held.
    return (referenceBranches ?? [])
      .filter((branch) => branchIds.includes(branch.id))
      .map((branch) => ({ id: branch.id, name: branch.name }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [settled, user, companyIds, context.companyId, referenceBranches, branchIds, lang]);

  const companyOptions = useMemo(() => {
    const query = companySearch.trim().toLocaleLowerCase(lang);
    return companies
      .filter((company) =>
        company.name.toLocaleLowerCase(lang).includes(query),
      )
      .map((company) => ({ value: company.id, label: company.name }));
  }, [companies, companySearch, lang]);

  const branchOptions = useMemo(() => {
    const query = branchSearch.trim().toLocaleLowerCase(lang);
    return [
      { value: ALL_PRICING_SCOPES, label: t.trade.scopeAllBranches },
      ...branches
        .filter((branch) => branch.name.toLocaleLowerCase(lang).includes(query))
        .map((branch) => ({ value: branch.id, label: branch.name })),
    ];
  }, [branches, branchSearch, lang, t.trade.scopeAllBranches]);

  const channelOptions = useMemo(() => {
    const query = channelSearch.trim().toLocaleLowerCase(lang);
    return [
      { value: ALL_PRICING_SCOPES, label: t.trade.scopeAllChannels },
      ...channels
        .filter((channel) =>
          channel.name.toLocaleLowerCase(lang).includes(query),
        )
        .map((channel) => ({ value: channel.id, label: channel.name })),
    ];
  }, [channels, channelSearch, lang, t.trade.scopeAllChannels]);

  const changeCompany = useCallback(
    (next: string | undefined) => {
      if (!next || next === ALL_PRICING_SCOPES) return;
      selectCompany(next);
      setCompanySearch("");
      setBranchSearch("");
      setChannelSearch("");
      onChannelScopeChange?.();
    },
    [selectCompany, onChannelScopeChange],
  );

  const changeBranch = useCallback(
    (next: string | undefined) => {
      if (!next || next === ALL_PRICING_SCOPES) selectBranch(null);
      else if (branches.some((branch) => branch.id === next)) selectBranch(next);
      setBranchSearch("");
    },
    [branches, selectBranch],
  );

  const changeChannel = useCallback(
    (next: string | undefined) => {
      selectChannel(next && next !== ALL_PRICING_SCOPES ? next : null);
      setChannelSearch("");
      onChannelScopeChange?.();
    },
    [selectChannel, onChannelScopeChange],
  );

  return {
    t,
    context,
    companyOptions,
    branchOptions,
    channelOptions,
    companyLabel:
      companies.find((company) => company.id === context.companyId)?.name ??
      t.trade.scopeSelectCompany,
    branchLabel:
      branches.find((branch) => branch.id === context.branchId)?.name ??
      t.trade.scopeAllBranches,
    channelLabel:
      channels.find((channel) => channel.id === context.channelId)?.name ??
      t.trade.scopeAllChannels,
    isLoading: key !== null && settled === null,
    canReadCompanies,
    canReadBranches: canReadBranches || (referenceBranches?.length ?? 0) > 0,
    companyError: settled?.companyError ?? null,
    branchError: settled?.branchError ?? null,
    isLoadingChannels,
    channelsError,
    refreshChannels,
    setCompanySearch,
    setBranchSearch,
    setChannelSearch,
    changeCompany,
    changeBranch,
    changeChannel,
    retry: () => {
      setDirectory(null);
      setRevision((current) => current + 1);
    },
  };
}
