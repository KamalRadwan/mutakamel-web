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
import { useTradeScope } from "../../useTradeScope";

export const ALL_PRICE_BOOK_SCOPES = "__all__";

interface Directory {
  key: string;
  companies: Company[];
  branches: Branch[];
  companyError: NormalizedApiError | null;
  branchError: NormalizedApiError | null;
}

// Core caps a page at 100. Read every page once so local searches include
// organizations beyond the first page, without sending the search text.
async function loadDirectory<L extends OrgLevel>(level: L, signal: AbortSignal) {
  const items: OrgNodeOf<L>[] = [];
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const result = await fetchOrgNodes(level, {
      page, limit: CORE_MAX_PAGE_LIMIT, search: "", signal,
      suppressForbiddenToast: true,
    });
    items.push(...result.items);
    if (!result.hasNext) return items;
    if (result.items.length === 0) throw new Error("Invalid organization pagination.");
  }
}

export function usePriceBookScopeOptions() {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { t, lang } = useI18n();
  const {
    context, companyIds, selectCompany, selectBranch,
    channels, isLoadingChannels, channelsError, selectChannel, refreshChannels,
  } = useTradeScope();
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const canReadCompanies = Boolean(user?.isTenantOwner || can(user, "org.company.read"));
  const canReadBranches = Boolean(user?.isTenantOwner || can(user, "org.branch.read"));
  const key = user?.id ? JSON.stringify([
    user.id, realtimeAuthGeneration, canReadCompanies, canReadBranches,
    [...companyIds].sort(), [...(user.accessibleBranches ?? [])].sort(), user.permissionScopes,
  ]) : null;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void Promise.allSettled([
      canReadCompanies ? loadDirectory("companies", controller.signal) : Promise.resolve([]),
      canReadBranches ? loadDirectory("branches", controller.signal) : Promise.resolve([]),
    ]).then(([companies, branches]) => {
      if (controller.signal.aborted) return;
      setDirectory({
        key,
        companies: companies.status === "fulfilled" ? companies.value : [],
        branches: branches.status === "fulfilled" ? branches.value : [],
        companyError: companies.status === "rejected" ? normalizeApiError(companies.reason) : null,
        branchError: branches.status === "rejected" ? normalizeApiError(branches.reason) : null,
      });
    });
    return () => controller.abort();
  }, [key, canReadCompanies, canReadBranches, revision]);

  const settled = key !== null && directory?.key === key ? directory : null;
  const companies = useMemo(() => (settled?.companies ?? [])
    .filter((company) => companyIds.includes(company.id))
    .sort((a, b) => a.name.localeCompare(b.name, lang)), [settled, companyIds, lang]);
  const branches = useMemo(() => (settled?.branches ?? [])
    .filter((branch) => user?.accessibleBranches.includes(branch.id) &&
      companyIds.includes(branch.companyId) &&
      (!context.companyId || branch.companyId === context.companyId))
    .sort((a, b) => a.name.localeCompare(b.name, lang)),
  [settled, user, companyIds, context.companyId, lang]);

  const companyOptions = useMemo(() =>
    companies.filter((company) => company.name.toLocaleLowerCase(lang)
      .includes(companySearch.trim().toLocaleLowerCase(lang)))
      .map((company) => ({ value: company.id, label: company.name })),
  [companies, companySearch, lang]);
  const branchOptions = useMemo(() => [
    { value: ALL_PRICE_BOOK_SCOPES, label: t.trade.scopeAllBranches },
    ...branches.filter((branch) => branch.name.toLocaleLowerCase(lang)
      .includes(branchSearch.trim().toLocaleLowerCase(lang)))
      .map((branch) => ({ value: branch.id, label: branch.name })),
  ], [branches, branchSearch, lang, t.trade.scopeAllBranches]);
  const channelOptions = useMemo(() => [
    { value: ALL_PRICE_BOOK_SCOPES, label: t.trade.scopeAllChannels },
    ...channels.filter((channel) => channel.name.toLocaleLowerCase(lang)
      .includes(channelSearch.trim().toLocaleLowerCase(lang)))
      .map((channel) => ({ value: channel.id, label: channel.name })),
  ], [channels, channelSearch, lang, t.trade.scopeAllChannels]);

  const changeCompany = useCallback((next: string | undefined) => {
    if (!next || next === ALL_PRICE_BOOK_SCOPES) return;
    selectCompany(next);
    setCompanySearch("");
    setBranchSearch("");
    setChannelSearch("");
  }, [selectCompany]);
  const changeBranch = useCallback((next: string | undefined) => {
    if (!next || next === ALL_PRICE_BOOK_SCOPES) selectBranch(null);
    else if (branches.some((branch) => branch.id === next)) selectBranch(next);
    setBranchSearch("");
  }, [branches, selectBranch]);
  const changeChannel = useCallback((next: string | undefined) => {
    selectChannel(next && next !== ALL_PRICE_BOOK_SCOPES ? next : null);
    setChannelSearch("");
  }, [selectChannel]);

  return {
    t, context, companyOptions, branchOptions, channelOptions,
    companyLabel: companies.find((company) => company.id === context.companyId)?.name ?? t.trade.scopeSelectCompany,
    branchLabel: branches.find((branch) => branch.id === context.branchId)?.name ?? t.trade.scopeAllBranches,
    channelLabel: channels.find((channel) => channel.id === context.channelId)?.name ?? t.trade.scopeAllChannels,
    isLoading: key !== null && settled === null,
    canReadCompanies, canReadBranches,
    companyError: settled?.companyError,
    branchError: settled?.branchError,
    isLoadingChannels, channelsError, refreshChannels,
    setCompanySearch, setBranchSearch, setChannelSearch, changeCompany, changeBranch, changeChannel,
    retry: () => { setDirectory(null); setRevision((current) => current + 1); },
  };
}
