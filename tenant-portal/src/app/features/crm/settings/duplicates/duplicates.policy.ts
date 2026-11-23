import {
  DisabledChoices,
  DisabledReasonKey,
  Effective,
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
export function resetsFromDetails(details: Record<string, unknown> | undefined, tree?: PolicyTree | null): Reset[] {
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
    const node = scopeType === 'COMPANY'
      ? tree?.companies.find((company) => company.companyId === ids[i])
      : tree?.companies.flatMap((company) => company.branches).find((branch) => branch.branchId === ids[i]);
    resets.push({ scopeType, id: ids[i], name: node?.name ?? names[i], switch: switchKey });
  }
  return resets;
}
