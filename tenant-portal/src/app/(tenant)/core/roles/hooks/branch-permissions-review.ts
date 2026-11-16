import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";
import {
  isReadOnlyPermissionKey,
  type BranchCatalogueTaxonomy,
} from "./branch-permissions-taxonomy";

type BranchAccessModeKind =
  | "FULL"
  | "FULL_MODULE"
  | "READ_ONLY"
  | "CUSTOM"
  | "EMPTY"
  | "EXCLUDED";

export interface BranchAccessModeSummary {
  kind: BranchAccessModeKind;
  moduleLabelAr?: string;
  moduleLabelEn?: string;
}

export interface BranchReviewItem {
  branchId: string;
  companyId: string;
  branchName: string;
  companyName: string;
  isActive: boolean;
  isIncluded: boolean;
  wasSaved: boolean;
  isDirty: boolean;
  mode: BranchAccessModeSummary;
  selectedCount: number;
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

export interface ScopeBranchOption {
  id: string;
  companyId: string;
  name: string;
  companyName: string;
  isActive: boolean;
  isSavedInactive?: boolean;
}

export interface ScopeCompanyOption {
  id: string;
  name: string;
  isActive: boolean;
  isSavedInactive?: boolean;
}

export function classifyBranchAccessMode(
  permissionIds: string[],
  isIncluded: boolean,
  taxonomy: BranchCatalogueTaxonomy,
): BranchAccessModeSummary {
  if (!isIncluded) return { kind: "EXCLUDED" };
  if (permissionIds.length === 0) return { kind: "EMPTY" };

  const selectedSet = new Set(permissionIds);
  const allModulesRows = taxonomy.modules.flatMap((mod) => mod.allRows);
  if (
    allModulesRows.length > 0 &&
    allModulesRows.every((row) => selectedSet.has(row.primaryItem.id))
  ) {
    if (taxonomy.modules.length === 1) {
      return {
        kind: "FULL_MODULE",
        moduleLabelAr: taxonomy.modules[0].labelAr,
        moduleLabelEn: taxonomy.modules[0].labelEn,
      };
    }
    return { kind: "FULL" };
  }

  const touchedModules = taxonomy.modules.filter((mod) =>
    mod.allRows.some((row) => row.allPermissionIds.some((id) => selectedSet.has(id))),
  );
  if (
    touchedModules.length === 1 &&
    touchedModules[0].allRows.length > 0 &&
    touchedModules[0].allRows.every((row) => selectedSet.has(row.primaryItem.id))
  ) {
    return {
      kind: "FULL_MODULE",
      moduleLabelAr: touchedModules[0].labelAr,
      moduleLabelEn: touchedModules[0].labelEn,
    };
  }

  const resolvedItems = permissionIds
    .map((id) => taxonomy.byId.get(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const hasNarrowScope = resolvedItems.some(
    (item) => item.recordScope === "OWN" || item.recordScope === "TEAM",
  );
  if (
    !hasNarrowScope &&
    resolvedItems.length > 0 &&
    resolvedItems.every((item) => isReadOnlyPermissionKey(item.key))
  ) {
    return { kind: "READ_ONLY" };
  }

  return { kind: "CUSTOM" };
}

export function formatBranchAccessModeLabel(
  summary: BranchAccessModeSummary,
  t: Dictionary,
  lang: Language,
): string {
  const modes = t.coreIdentity.roleBranch.permissions.modes;
  switch (summary.kind) {
    case "FULL":
      return modes.full;
    case "FULL_MODULE":
      return formatTemplate(modes.fullModule, {
        module: localizedValue(summary.moduleLabelAr, summary.moduleLabelEn, lang),
      });
    case "READ_ONLY":
      return modes.readOnly;
    case "CUSTOM":
      return modes.custom;
    case "EMPTY":
      return modes.empty;
    case "EXCLUDED":
      return modes.excluded;
  }
}

export function computeBranchReviewItems(options: {
  document: RoleBranchPermissionsDocument;
  draftProfiles: Readonly<Record<string, string[]>>;
  selectedCompanyIds: string[];
  branchesById: ReadonlyMap<string, ScopeBranchOption>;
  taxonomy: BranchCatalogueTaxonomy;
}): {
  items: BranchReviewItem[];
  dirtyBranchCount: number;
  isDirty: boolean;
} {
  const { document, draftProfiles, selectedCompanyIds, branchesById, taxonomy } = options;
  const baselineByBranch = new Map(
    document.profiles.map((profile) => [profile.branchId, profile]),
  );

  const orderedBranchIds: string[] = [];
  const seen = new Set<string>();
  const pushBranch = (branchId: string) => {
    if (!seen.has(branchId)) {
      seen.add(branchId);
      orderedBranchIds.push(branchId);
    }
  };

  for (const branchId of Object.keys(draftProfiles)) pushBranch(branchId);
  for (const profile of document.profiles) pushBranch(profile.branchId);
  for (const branch of branchesById.values()) {
    if (selectedCompanyIds.includes(branch.companyId)) pushBranch(branch.id);
  }

  let dirtyBranchCount = 0;
  const items: BranchReviewItem[] = orderedBranchIds.map((branchId) => {
    const baseline = baselineByBranch.get(branchId);
    const meta = branchesById.get(branchId);
    const isIncluded = Object.prototype.hasOwnProperty.call(draftProfiles, branchId);
    const nextIds = isIncluded ? draftProfiles[branchId] : [];
    const prevIds = baseline?.permissionIds ?? [];
    const prevSet = new Set(prevIds);
    const nextSet = new Set(nextIds);

    const addedCount = isIncluded ? nextIds.filter((id) => !prevSet.has(id)).length : 0;
    const removedCount = baseline
      ? isIncluded
        ? prevIds.filter((id) => !nextSet.has(id)).length
        : prevIds.length
      : 0;
    const unchangedCount =
      baseline && isIncluded ? nextIds.filter((id) => prevSet.has(id)).length : 0;

    const wasSaved = baseline !== undefined;
    const isBranchDirty = wasSaved !== isIncluded || addedCount > 0 || removedCount > 0;
    if (isBranchDirty) dirtyBranchCount += 1;

    return {
      branchId,
      companyId: meta?.companyId ?? baseline?.companyId ?? "",
      branchName: meta?.name ?? baseline?.branchName ?? branchId,
      companyName: meta?.companyName ?? baseline?.companyName ?? "",
      isActive: meta?.isActive ?? baseline?.isActive ?? true,
      isIncluded,
      wasSaved,
      isDirty: isBranchDirty,
      mode: classifyBranchAccessMode(nextIds, isIncluded, taxonomy),
      selectedCount: nextIds.length,
      addedCount,
      removedCount,
      unchangedCount,
    };
  });

  const transitionsMode =
    document.permissionMode === "GLOBAL" && Object.keys(draftProfiles).length > 0;
  return {
    items,
    dirtyBranchCount,
    isDirty: dirtyBranchCount > 0 || transitionsMode,
  };
}

export function formatReviewDiffDescription(
  item: BranchReviewItem,
  t: Dictionary,
  lang: Language,
): string {
  const copy = t.coreIdentity.roleBranch.review;
  const fmt = (n: number) => formatNumber(n, lang);

  if (!item.isIncluded) {
    if (item.wasSaved) {
      return formatTemplate(copy.diffRemovedProfile, { removed: fmt(item.removedCount) });
    }
    return copy.diffExcluded;
  }

  if (!item.wasSaved) {
    if (item.selectedCount === 0) return copy.diffNewEmpty;
    if (item.mode.kind === "FULL_MODULE") {
      return formatTemplate(copy.diffNewFull, {
        module: localizedValue(item.mode.moduleLabelAr, item.mode.moduleLabelEn, lang),
        count: fmt(item.selectedCount),
      });
    }
    return formatTemplate(copy.diffNewProfile, { count: fmt(item.selectedCount) });
  }

  if (item.addedCount > 0 && item.removedCount > 0) {
    return formatTemplate(copy.diffUpdated, {
      added: fmt(item.addedCount),
      removed: fmt(item.removedCount),
      unchanged: fmt(item.unchangedCount),
    });
  }
  if (item.addedCount > 0) {
    return formatTemplate(copy.diffAddedOnly, {
      added: fmt(item.addedCount),
      unchanged: fmt(item.unchangedCount),
    });
  }
  if (item.removedCount > 0) {
    return formatTemplate(copy.diffRemovedOnly, {
      removed: fmt(item.removedCount),
      unchanged: fmt(item.unchangedCount),
    });
  }
  return formatTemplate(copy.diffUnchanged, { unchanged: fmt(item.unchangedCount) });
}
