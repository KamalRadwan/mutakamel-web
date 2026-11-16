import type { Language } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import type { RoleRecordScope } from "../contracts/role-branch-contract";
import type {
  BranchActionRow,
  BranchGroupNode,
  BranchModuleNode,
  BranchSubgroupNode,
} from "./branch-permissions-taxonomy";

export type BranchPermissionFilterMode = "all" | "selected" | "view" | "scoped";
type TriStateChecked = boolean | "indeterminate";
type GroupSelectionSummaryKind = "full" | "partial" | "custom" | "none";

export function resolveSelectedRowScope(
  row: BranchActionRow,
  selectedSet: ReadonlySet<string>,
): RoleRecordScope | null {
  for (const scope of ["ALL", "TEAM", "OWN"] as const) {
    const match = row.variants.find((variant) => variant.scope === scope);
    if (match && selectedSet.has(match.item.id)) return scope;
  }
  return null;
}

export function isBranchActionRowSelected(
  row: BranchActionRow,
  selectedSet: ReadonlySet<string>,
): boolean {
  return row.allPermissionIds.some((id) => selectedSet.has(id));
}

export function computeNodeSelectionState(
  rows: BranchActionRow[],
  selectedSet: ReadonlySet<string>,
): { checked: TriStateChecked; summaryKind: GroupSelectionSummaryKind } {
  if (rows.length === 0) return { checked: false, summaryKind: "none" };
  let activeCount = 0;
  let allBroadest = true;
  let hasNarrowScope = false;

  for (const row of rows) {
    const selected = isBranchActionRowSelected(row, selectedSet);
    if (selected) activeCount += 1;
    if (!selectedSet.has(row.primaryItem.id)) allBroadest = false;
    if (selected && row.variants.length > 1 && !selectedSet.has(row.primaryItem.id)) {
      hasNarrowScope = true;
    }
  }

  if (activeCount === 0) return { checked: false, summaryKind: "none" };
  if (activeCount === rows.length && allBroadest) return { checked: true, summaryKind: "full" };
  return {
    checked: "indeterminate",
    summaryKind: hasNarrowScope ? "custom" : "partial",
  };
}

export function toggleBranchActionRow(
  selectedIds: string[],
  row: BranchActionRow,
): string[] {
  const rowIds = new Set(row.allPermissionIds);
  const currentlySelected = selectedIds.some((id) => rowIds.has(id));
  const withoutRow = selectedIds.filter((id) => !rowIds.has(id));
  return currentlySelected ? withoutRow : [...withoutRow, row.primaryItem.id];
}

export function changeBranchActionRecordScope(
  selectedIds: string[],
  row: BranchActionRow,
  nextScope: RoleRecordScope,
): string[] {
  const target = row.variants.find((variant) => variant.scope === nextScope)?.item;
  if (!target) return selectedIds;
  const rowIds = new Set(row.allPermissionIds);
  const withoutRow = selectedIds.filter((id) => !rowIds.has(id));
  return [...withoutRow, target.id];
}

export function toggleBranchRowCollection(
  selectedIds: string[],
  rows: BranchActionRow[],
): string[] {
  const selectedSet = new Set(selectedIds);
  const { checked } = computeNodeSelectionState(rows, selectedSet);
  const collectionIds = new Set(rows.flatMap((row) => row.allPermissionIds));
  const withoutCollection = selectedIds.filter((id) => !collectionIds.has(id));
  if (checked === true) return withoutCollection;
  return [...withoutCollection, ...rows.map((row) => row.primaryItem.id)];
}

export function filterBranchTaxonomy(
  modules: BranchModuleNode[],
  options: {
    searchQuery: string;
    filterMode: BranchPermissionFilterMode;
    selectedSet: ReadonlySet<string>;
    lang: Language;
  },
): BranchModuleNode[] {
  const needle = options.searchQuery.trim().toLowerCase();
  const matchesText = (ar: string, en: string) =>
    needle.length === 0 ||
    localizedValue(ar, en, options.lang).toLowerCase().includes(needle) ||
    ar.toLowerCase().includes(needle) ||
    en.toLowerCase().includes(needle);

  const rowPassesMode = (row: BranchActionRow): boolean => {
    if (options.filterMode === "selected") {
      return isBranchActionRowSelected(row, options.selectedSet);
    }
    if (options.filterMode === "view") return row.isViewAction;
    if (options.filterMode === "scoped") {
      return row.variants.length > 1 || row.primaryItem.recordScope !== null;
    }
    return true;
  };

  const result: BranchModuleNode[] = [];
  for (const mod of modules) {
    const modMatches = needle.length > 0 && matchesText(mod.labelAr, mod.labelEn);
    const filteredGroups: BranchGroupNode[] = [];

    for (const grp of mod.groups) {
      const grpMatches = modMatches || (needle.length > 0 && matchesText(grp.labelAr, grp.labelEn));
      const directRows = grp.directRows.filter(
        (row) => rowPassesMode(row) && (grpMatches || matchesText(row.labelAr, row.labelEn)),
      );
      const subgroups: BranchSubgroupNode[] = [];
      for (const sub of grp.subgroups) {
        const subMatches = grpMatches || (needle.length > 0 && matchesText(sub.labelAr, sub.labelEn));
        const rows = sub.rows.filter(
          (row) => rowPassesMode(row) && (subMatches || matchesText(row.labelAr, row.labelEn)),
        );
        if (rows.length > 0) subgroups.push({ ...sub, rows });
      }
      const allRows = [...directRows, ...subgroups.flatMap((sub) => sub.rows)];
      if (allRows.length > 0) {
        filteredGroups.push({ ...grp, directRows, subgroups, allRows });
      }
    }

    if (filteredGroups.length > 0) {
      result.push({
        ...mod,
        groups: filteredGroups,
        allRows: filteredGroups.flatMap((grp) => grp.allRows),
      });
    }
  }
  return result;
}
