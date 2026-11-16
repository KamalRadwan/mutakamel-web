"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { CORE_MAX_PAGE_LIMIT } from "../../contracts/core-page";
import {
  fetchOrgNodes,
  type Branch,
  type Company,
} from "../../contracts/organization-contract";
import type { RoleBranchProfile } from "../contracts/role-branch-contract";
import type {
  ScopeBranchOption,
  ScopeCompanyOption,
} from "./branch-permissions-review";

/** Bounded page walk so a malformed `hasNext` never loops indefinitely. */
const MAX_ORG_SCOPE_PAGES = 20;

export function mergeScopeOptionsWithSavedProfiles(
  activeCompanies: Company[],
  activeBranches: Branch[],
  savedProfiles: RoleBranchProfile[],
): {
  companies: ScopeCompanyOption[];
  branches: ScopeBranchOption[];
  branchesById: Map<string, ScopeBranchOption>;
} {
  const companyMap = new Map<string, ScopeCompanyOption>();
  for (const company of activeCompanies) {
    if (company.status !== "ACTIVE") continue;
    companyMap.set(company.id, {
      id: company.id,
      name: company.name,
      isActive: true,
    });
  }

  const branchMap = new Map<string, ScopeBranchOption>();
  for (const branch of activeBranches) {
    if (branch.status !== "ACTIVE") continue;
    const parent = companyMap.get(branch.companyId);
    if (!parent) continue;
    branchMap.set(branch.id, {
      id: branch.id,
      companyId: branch.companyId,
      name: branch.name,
      companyName: parent.name,
      isActive: true,
    });
  }

  // Preserve saved profile labels even when a company or branch was deactivated
  // later, so the owner can review and remove stale profiles explicitly.
  for (const profile of savedProfiles) {
    if (!companyMap.has(profile.companyId)) {
      companyMap.set(profile.companyId, {
        id: profile.companyId,
        name: profile.companyName,
        isActive: profile.isActive,
        isSavedInactive: !profile.isActive,
      });
    }
    const existingBranch = branchMap.get(profile.branchId);
    if (!existingBranch) {
      branchMap.set(profile.branchId, {
        id: profile.branchId,
        companyId: profile.companyId,
        name: profile.branchName,
        companyName: profile.companyName,
        isActive: profile.isActive,
        isSavedInactive: !profile.isActive,
      });
    } else if (!profile.isActive) {
      branchMap.set(profile.branchId, {
        ...existingBranch,
        isActive: false,
        isSavedInactive: true,
      });
    }
  }

  const companies = [...companyMap.values()];
  const branches = [...branchMap.values()];
  return { companies, branches, branchesById: branchMap };
}

export function deriveInitialScopeSelection(options: {
  savedProfiles: RoleBranchProfile[];
  companies: ScopeCompanyOption[];
  branches: ScopeBranchOption[];
  isComplete: boolean;
}): {
  selectedCompanyIds: string[];
  draftProfiles: Record<string, string[]>;
  autoSelectedSingleCompany: boolean;
  autoSelectedSingleBranchId: string | null;
} {
  const { savedProfiles, companies, branches, isComplete } = options;

  if (savedProfiles.length > 0) {
    const selectedCompanyIds: string[] = [];
    const draftProfiles: Record<string, string[]> = {};
    for (const profile of savedProfiles) {
      if (!selectedCompanyIds.includes(profile.companyId)) {
        selectedCompanyIds.push(profile.companyId);
      }
      draftProfiles[profile.branchId] = [...profile.permissionIds];
    }
    return {
      selectedCompanyIds,
      draftProfiles,
      autoSelectedSingleCompany: false,
      autoSelectedSingleBranchId: null,
    };
  }

  // Never infer sole-option defaults from partial, failed, or searched pages.
  if (!isComplete) {
    return {
      selectedCompanyIds: [],
      draftProfiles: {},
      autoSelectedSingleCompany: false,
      autoSelectedSingleBranchId: null,
    };
  }

  const activeCompanies = companies.filter((company) => company.isActive);
  if (activeCompanies.length !== 1) {
    return {
      selectedCompanyIds: [],
      draftProfiles: {},
      autoSelectedSingleCompany: false,
      autoSelectedSingleBranchId: null,
    };
  }

  const soleCompany = activeCompanies[0];
  const eligibleBranches = branches.filter(
    (branch) => branch.isActive && branch.companyId === soleCompany.id,
  );
  if (eligibleBranches.length === 1) {
    const soleBranch = eligibleBranches[0];
    return {
      selectedCompanyIds: [soleCompany.id],
      draftProfiles: { [soleBranch.id]: [] },
      autoSelectedSingleCompany: true,
      autoSelectedSingleBranchId: soleBranch.id,
    };
  }

  return {
    selectedCompanyIds: [soleCompany.id],
    draftProfiles: {},
    autoSelectedSingleCompany: true,
    autoSelectedSingleBranchId: null,
  };
}

async function fetchAllActiveOrgLevel<L extends "companies" | "branches">(
  level: L,
  signal: AbortSignal,
) {
  const items: Array<L extends "companies" ? Company : Branch> = [];
  let completed = false;
  for (let page = 1; page <= MAX_ORG_SCOPE_PAGES; page += 1) {
    const response = await fetchOrgNodes(level, {
      page,
      search: "",
      status: "ACTIVE",
      limit: CORE_MAX_PAGE_LIMIT,
      sortBy: "name",
      sortDir: "ASC",
      signal,
      suppressForbiddenToast: true,
    });
    items.push(...(response.items as Array<L extends "companies" ? Company : Branch>));
    if (!response.hasNext) {
      completed = true;
      break;
    }
  }
  return { items, completed };
}

export function useRoleBranchScopeOptions(options: {
  open: boolean;
  mode: "edit" | "view";
  savedProfiles: RoleBranchProfile[];
  reloadToken: number;
}) {
  const { open, mode, savedProfiles, reloadToken } = options;
  const [rawCompanies, setRawCompanies] = useState<Company[]>([]);
  const [rawBranches, setRawBranches] = useState<Branch[]>([]);
  const [isLoadingScope, setIsLoadingScope] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [scopeError, setScopeError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoadingScope(true);
      setIsComplete(false);
      setScopeError(null);
      Promise.all([
        fetchAllActiveOrgLevel("companies", controller.signal),
        fetchAllActiveOrgLevel("branches", controller.signal),
      ])
        .then(([companiesRes, branchesRes]) => {
          if (controller.signal.aborted) return;
          if (!companiesRes.completed || !branchesRes.completed) {
            setRawCompanies([]);
            setRawBranches([]);
            setIsComplete(false);
            if (mode === "edit") {
              setScopeError({ status: 422, code: "ORG_TREE_TOO_LARGE" });
            }
            return;
          }
          setRawCompanies(companiesRes.items);
          setRawBranches(branchesRes.items);
          setIsComplete(true);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRawCompanies([]);
          setRawBranches([]);
          setIsComplete(false);
          if (mode === "edit") {
            setScopeError(normalizeApiError(error));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoadingScope(false);
        });
    });
    return () => controller.abort();
  }, [mode, open, reloadToken]);

  const merged = useMemo(
    () => mergeScopeOptionsWithSavedProfiles(rawCompanies, rawBranches, savedProfiles),
    [rawBranches, rawCompanies, savedProfiles],
  );

  return {
    companies: merged.companies,
    branches: merged.branches,
    branchesById: merged.branchesById,
    isLoadingScope,
    isComplete,
    scopeError,
  };
}
