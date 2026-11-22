import {
  BranchOverride,
  CompanyOverride,
  DisabledChoices,
  DisabledReasonKey,
  Effective,
  Limits,
  NodeOverrides,
  PolicyDefaults,
  PolicySwitch,
  PolicyTree,
  Reset,
  Tri,
} from './duplicates.model';

/** Compute effective workspace flags respecting the U => B => C chain. */
export function resolveDefaultsEffective(defaults: PolicyDefaults): Effective {
  const c = defaults.allowAcrossCompanies;
  const b = defaults.allowAcrossBranches && c;
  const u = defaults.allowAcrossUsers && b;
  return { u, b, c };
}

/** Resolve effective values and chain limits for a company node (resolveDuplicateNode: a limit marks any requested switch the chain clamps). */
export function resolveCompanyNode(
  override: CompanyOverride,
  parentEffective: Effective,
): { effective: Effective; limits: Limits } {
  const c = override.allowAcrossCompanies ?? parentEffective.c;
  const rawB = override.allowAcrossBranches ?? parentEffective.b;
  const bLimited = rawB && !c;
  const b = rawB && c;
  const rawU = override.allowAcrossUsers ?? parentEffective.u;
  const uLimited = rawU && !b;
  const u = rawU && b;

  const limits: Limits = {};
  if (bLimited) limits.b = 'CHAIN';
  if (uLimited) limits.u = 'CHAIN';

  return { effective: { u, b, c }, limits };
}

/** Resolve effective values and chain limits for a branch node (resolveDuplicateNode with allowAcrossCompanies null). */
export function resolveBranchNode(
  override: BranchOverride,
  companyEffective: Effective,
): { effective: Effective; limits: Limits } {
  const c = companyEffective.c;
  const rawB = override.allowAcrossBranches ?? companyEffective.b;
  const bLimited = rawB && !c;
  const b = rawB && c;
  const rawU = override.allowAcrossUsers ?? companyEffective.u;
  const uLimited = rawU && !b;
  const u = rawU && b;

  const limits: Limits = {};
  if (bLimited) limits.b = 'CHAIN';
  if (uLimited) limits.u = 'CHAIN';

  return { effective: { u, b, c }, limits };
}

/** Recompute all effective values and chain limits across the whole policy tree. */
export function resolvePolicyTree(tree: PolicyTree): PolicyTree {
  const workspaceEffective = resolveDefaultsEffective(tree.defaults);
  return {
    revision: tree.revision,
    truncated: tree.truncated,
    defaults: { ...tree.defaults },
    companies: tree.companies.map((company) => {
      const override = { ...company.override };
      const resolvedCompany = resolveCompanyNode(override, workspaceEffective);
      return {
        ...company,
        override,
        effective: resolvedCompany.effective,
        limits: resolvedCompany.limits,
        branches: company.branches.map((branch) => {
          const branchOverride = { ...branch.override };
          const resolvedBranch = resolveBranchNode(branchOverride, resolvedCompany.effective);
          return {
            ...branch,
            override: branchOverride,
            effective: resolvedBranch.effective,
            limits: resolvedBranch.limits,
          };
        }),
      };
    }),
  };
}

/** Return the conflicting explicit switch when a single node breaks U => B => C. */
export function findNodeChainConflict(params: {
  effectiveC: boolean;
  rawB: boolean;
  explicitB: boolean;
  explicitU: boolean;
}): 'b' | 'u' | null {
  if (params.explicitB && !params.effectiveC) {
    return 'b';
  }
  const effectiveB = params.rawB && params.effectiveC;
  if (params.explicitU && !effectiveB) {
    return 'u';
  }
  return null;
}

/** Collect explicit child overrides invalidated by a workspace or company change. */
export function collectChildResets(
  tree: PolicyTree,
  scope: 'WORKSPACE' | 'COMPANY',
  targetCompanyId?: string,
): Reset[] {
  const resets: Reset[] = [];
  const workspaceEffective = resolveDefaultsEffective(tree.defaults);

  for (const company of tree.companies) {
    const cEff = company.override.allowAcrossCompanies ?? workspaceEffective.c;
    const companyResetsB =
      scope === 'WORKSPACE' && company.override.allowAcrossBranches === true && !cEff;
    if (companyResetsB) {
      resets.push({
        scopeType: 'COMPANY',
        id: company.companyId,
        name: company.name,
        switch: 'b',
      });
    }

    const companyRawB = companyResetsB
      ? workspaceEffective.b
      : (company.override.allowAcrossBranches ?? workspaceEffective.b);
    const companyBEff = companyRawB && cEff;

    const companyResetsU =
      scope === 'WORKSPACE' && company.override.allowAcrossUsers === true && !companyBEff;
    if (companyResetsU) {
      resets.push({
        scopeType: 'COMPANY',
        id: company.companyId,
        name: company.name,
        switch: 'u',
      });
    }

    if (scope === 'COMPANY' && company.companyId !== targetCompanyId) {
      continue;
    }

    for (const branch of company.branches) {
      const branchResetsB = branch.override.allowAcrossBranches === true && !cEff;
      if (branchResetsB) {
        resets.push({
          scopeType: 'BRANCH',
          id: branch.branchId,
          name: branch.name,
          switch: 'b',
        });
      }

      const branchRawB = branchResetsB
        ? companyBEff
        : (branch.override.allowAcrossBranches ?? companyBEff);
      const branchBEff = branchRawB && cEff;

      if (branch.override.allowAcrossUsers === true && !branchBEff) {
        resets.push({
          scopeType: 'BRANCH',
          id: branch.branchId,
          name: branch.name,
          switch: 'u',
        });
      }
    }
  }

  return resets;
}

/** Clear the specified child overrides back to inherit (null) and re-resolve the tree. */
export function applyResets(tree: PolicyTree, resets: readonly Reset[]): PolicyTree {
  const companyMap = new Map<string, Set<'u' | 'b'>>();
  const branchMap = new Map<string, Set<'u' | 'b'>>();

  for (const reset of resets) {
    const map = reset.scopeType === 'COMPANY' ? companyMap : branchMap;
    const set = map.get(reset.id) ?? new Set<'u' | 'b'>();
    set.add(reset.switch);
    map.set(reset.id, set);
  }

  const next: PolicyTree = {
    ...tree,
    defaults: { ...tree.defaults },
    companies: tree.companies.map((company) => {
      const cSwitches = companyMap.get(company.companyId);
      const override: CompanyOverride = {
        allowAcrossUsers: cSwitches?.has('u') ? null : company.override.allowAcrossUsers,
        allowAcrossBranches: cSwitches?.has('b') ? null : company.override.allowAcrossBranches,
        allowAcrossCompanies: company.override.allowAcrossCompanies,
      };
      return {
        ...company,
        override,
        branches: company.branches.map((branch) => {
          const bSwitches = branchMap.get(branch.branchId);
          return {
            ...branch,
            override: {
              allowAcrossUsers: bSwitches?.has('u') ? null : branch.override.allowAcrossUsers,
              allowAcrossBranches: bSwitches?.has('b') ? null : branch.override.allowAcrossBranches,
            },
          };
        }),
      };
    }),
  };

  return resolvePolicyTree(next);
}

function conflictToReason(
  switchKey: PolicySwitch,
  conflict: 'b' | 'u' | null,
): DisabledReasonKey | null {
  if (!conflict) return null;
  if (conflict === switchKey) {
    return switchKey === 'u' ? 'needsB' : 'needsC';
  }
  return conflict === 'b' ? 'blocksB' : 'blocksU';
}

/** Compute which menu choices would break the U => B => C chain at this node. */
export function computeDisabledChoices(params: {
  mode: 'root' | 'node';
  switchKey: PolicySwitch;
  overrides: NodeOverrides;
  parentEffective: Effective;
}): DisabledChoices {
  const evaluate = (choice: Tri): DisabledReasonKey | null => {
    const nextU = params.switchKey === 'u' ? choice : params.overrides.u;
    const nextB = params.switchKey === 'b' ? choice : params.overrides.b;
    const nextC = params.switchKey === 'c' ? choice : params.overrides.c;

    const effectiveC =
      params.mode === 'root' ? nextC === true : (nextC ?? params.parentEffective.c);
    const rawB =
      params.mode === 'root' ? nextB === true : (nextB ?? params.parentEffective.b);

    const conflict = findNodeChainConflict({
      effectiveC,
      rawB,
      explicitB: nextB === true,
      explicitU: nextU === true,
    });
    return conflictToReason(params.switchKey, conflict);
  };

  return {
    inherit: params.mode === 'node' ? evaluate(null) : null,
    allow: evaluate(true),
    deny: evaluate(false),
  };
}

/**
 * Reads 409 CRM_DUPLICATE_POLICY_RESETS_REQUIRED details: parallel string arrays scopeType (lowercase), id,
 * name and switch (duplicate-policy.service.ts:71), zipped by index. Entries with an unknown scope or switch,
 * or arrays of different lengths, are skipped.
 */
export function resetsFromDetails(details: Record<string, unknown> | undefined): Reset[] {
  const list = (key: string): string[] => {
    const value = details?.[key];
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
  };
  const scopeTypes = list('scopeType');
  const ids = list('id');
  const names = list('name');
  const switches = list('switch');
  const count = Math.min(scopeTypes.length, ids.length, names.length, switches.length);
  const resets: Reset[] = [];
  for (let i = 0; i < count; i++) {
    const scopeType = scopeTypes[i].toUpperCase();
    const switchKey = switches[i];
    if ((scopeType !== 'COMPANY' && scopeType !== 'BRANCH') || (switchKey !== 'u' && switchKey !== 'b')) continue;
    resets.push({ scopeType, id: ids[i], name: names[i], switch: switchKey });
  }
  return resets;
}
