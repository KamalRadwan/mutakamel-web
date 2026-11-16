import {
  ROLE_RECORD_SCOPES,
  type RoleBranchCatalogueItem,
  type RoleRecordScope,
} from "../contracts/role-branch-contract";

interface BranchActionVariant {
  scope: RoleRecordScope;
  item: RoleBranchCatalogueItem;
}

export interface BranchActionRow {
  id: string;
  labelAr: string;
  labelEn: string;
  isViewAction: boolean;
  /** Multiple entries mean real OWN/TEAM/ALL catalogue keys exist for this action. */
  variants: BranchActionVariant[];
  /** Broadest real catalogue item for single-click check and bulk-check operations. */
  primaryItem: RoleBranchCatalogueItem;
  allPermissionIds: string[];
}

export interface BranchSubgroupNode {
  id: string;
  labelAr: string;
  labelEn: string;
  rows: BranchActionRow[];
}

export interface BranchGroupNode {
  id: string;
  labelAr: string;
  labelEn: string;
  directRows: BranchActionRow[];
  subgroups: BranchSubgroupNode[];
  allRows: BranchActionRow[];
}

export interface BranchModuleNode {
  id: string;
  labelAr: string;
  labelEn: string;
  groups: BranchGroupNode[];
  allRows: BranchActionRow[];
}

export interface BranchCatalogueTaxonomy {
  modules: BranchModuleNode[];
  tenantLockedItems: RoleBranchCatalogueItem[];
  branchCatalogueIds: ReadonlySet<string>;
  byId: ReadonlyMap<string, RoleBranchCatalogueItem>;
}

const VIEW_ACTION_KEY_PATTERN = /(?:^|[._:-])(?:read|view|list|get)(?:[._:-](?:own|team|all))?$/i;
const TRAILING_RECORD_SCOPE_PATTERN = /[._:-](?:own|team|all)$/i;

export function isReadOnlyPermissionKey(key: string): boolean {
  return VIEW_ACTION_KEY_PATTERN.test(key.trim());
}

function normalizeActionStem(item: RoleBranchCatalogueItem): string | null {
  if (item.recordScope === null) return null;
  return item.key.trim().toLowerCase().replace(TRAILING_RECORD_SCOPE_PATTERN, "");
}

function buildActionRows(items: RoleBranchCatalogueItem[]): BranchActionRow[] {
  const byStem = new Map<string, RoleBranchCatalogueItem[]>();
  for (const item of items) {
    const stem = normalizeActionStem(item);
    if (!stem) continue;
    const bucket = byStem.get(stem);
    if (bucket) bucket.push(item);
    else byStem.set(stem, [item]);
  }

  const mergeableStems = new Set<string>();
  for (const [stem, bucket] of byStem.entries()) {
    if (bucket.length < 2) continue;
    const distinctScopes = new Set(bucket.map((entry) => entry.recordScope));
    if (distinctScopes.size === bucket.length) mergeableStems.add(stem);
  }

  const emittedStems = new Set<string>();
  const rows: BranchActionRow[] = [];

  for (const item of items) {
    const stem = normalizeActionStem(item);
    if (stem && mergeableStems.has(stem)) {
      if (emittedStems.has(stem)) continue;
      emittedStems.add(stem);
      const bucket = byStem.get(stem) ?? [item];
      const variants: BranchActionVariant[] = ROLE_RECORD_SCOPES.flatMap((scope) => {
        const match = bucket.find((candidate) => candidate.recordScope === scope);
        return match ? [{ scope, item: match }] : [];
      });
      const primaryItem =
        variants.find((variant) => variant.scope === "ALL")?.item ??
        variants.find((variant) => variant.scope === "TEAM")?.item ??
        variants[0].item;
      rows.push({
        id: `family:${stem}`,
        labelAr: primaryItem.nameAr,
        labelEn: primaryItem.nameEn,
        isViewAction: bucket.every((entry) => isReadOnlyPermissionKey(entry.key)),
        variants,
        primaryItem,
        allPermissionIds: variants.map((variant) => variant.item.id),
      });
      continue;
    }

    rows.push({
      id: item.id,
      labelAr: item.nameAr,
      labelEn: item.nameEn,
      isViewAction: isReadOnlyPermissionKey(item.key),
      variants: item.recordScope ? [{ scope: item.recordScope, item }] : [],
      primaryItem: item,
      allPermissionIds: [item.id],
    });
  }

  return rows;
}

export function buildBranchCatalogueTaxonomy(
  catalogue: RoleBranchCatalogueItem[],
): BranchCatalogueTaxonomy {
  const byId = new Map<string, RoleBranchCatalogueItem>();
  const branchIds = new Set<string>();
  const branchItems: RoleBranchCatalogueItem[] = [];
  const tenantLockedItems: RoleBranchCatalogueItem[] = [];

  for (const item of catalogue) {
    byId.set(item.id, item);
    if (item.scope === "BRANCH") {
      branchIds.add(item.id);
      branchItems.push(item);
    } else {
      tenantLockedItems.push(item);
    }
  }

  interface SubgroupDraft {
    id: string;
    labelAr: string;
    labelEn: string;
    items: RoleBranchCatalogueItem[];
  }
  interface GroupDraft {
    id: string;
    labelAr: string;
    labelEn: string;
    directItems: RoleBranchCatalogueItem[];
    subgroups: Map<string, SubgroupDraft>;
  }
  interface ModuleDraft {
    id: string;
    labelAr: string;
    labelEn: string;
    groups: Map<string, GroupDraft>;
  }

  const moduleMap = new Map<string, ModuleDraft>();
  for (const item of branchItems) {
    let mod = moduleMap.get(item.module.id);
    if (!mod) {
      mod = {
        id: item.module.id,
        labelAr: item.module.nameAr,
        labelEn: item.module.nameEn,
        groups: new Map(),
      };
      moduleMap.set(item.module.id, mod);
    }

    const firstGroup = item.groups[0] ?? item.module;
    let grp = mod.groups.get(firstGroup.id);
    if (!grp) {
      grp = {
        id: `${mod.id}/${firstGroup.id}`,
        labelAr: firstGroup.nameAr,
        labelEn: firstGroup.nameEn,
        directItems: [],
        subgroups: new Map(),
      };
      mod.groups.set(firstGroup.id, grp);
    }

    if (item.groups.length <= 1) {
      grp.directItems.push(item);
    } else {
      const rest = item.groups.slice(1);
      const subKey = rest.map((node) => node.id).join("/");
      let sub = grp.subgroups.get(subKey);
      if (!sub) {
        sub = {
          id: `${grp.id}/${subKey}`,
          labelAr: rest.map((node) => node.nameAr).join(" · "),
          labelEn: rest.map((node) => node.nameEn).join(" · "),
          items: [],
        };
        grp.subgroups.set(subKey, sub);
      }
      sub.items.push(item);
    }
  }

  const modules: BranchModuleNode[] = [...moduleMap.values()].map((mod) => {
    const groups: BranchGroupNode[] = [...mod.groups.values()].map((grp) => {
      const directRows = buildActionRows(grp.directItems);
      const subgroups: BranchSubgroupNode[] = [...grp.subgroups.values()].map((sub) => ({
        id: sub.id,
        labelAr: sub.labelAr,
        labelEn: sub.labelEn,
        rows: buildActionRows(sub.items),
      }));
      const allRows = [...directRows, ...subgroups.flatMap((sub) => sub.rows)];
      return {
        id: grp.id,
        labelAr: grp.labelAr,
        labelEn: grp.labelEn,
        directRows,
        subgroups,
        allRows,
      };
    });
    return {
      id: mod.id,
      labelAr: mod.labelAr,
      labelEn: mod.labelEn,
      groups,
      allRows: groups.flatMap((grp) => grp.allRows),
    };
  });

  return {
    modules,
    tenantLockedItems,
    branchCatalogueIds: branchIds,
    byId,
  };
}
