import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import type { NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { resolveCoreErrorText } from "../../hooks/useCoreErrorText";
import type {
  RoleBranchPermissionsDocument,
  SaveRoleBranchProfileInput,
} from "../contracts/role-branch-contract";
import {
  classifyBranchAccessMode,
  formatBranchAccessModeLabel,
  type ScopeBranchOption,
} from "./branch-permissions-review";
import { buildBranchCatalogueTaxonomy } from "./branch-permissions-taxonomy";

type UncertainSaveResolution = "APPLIED" | "CONFLICT" | "NOT_APPLIED";

function sameProfileSets(
  intended: SaveRoleBranchProfileInput[],
  actual: RoleBranchPermissionsDocument["profiles"],
): boolean {
  if (intended.length !== actual.length) return false;
  const actualMap = new Map(
    actual.map((profile) => [profile.branchId, new Set(profile.permissionIds)]),
  );
  return intended.every((entry) => {
    const serverSet = actualMap.get(entry.branchId);
    if (!serverSet || serverSet.size !== entry.permissionIds.length) return false;
    return entry.permissionIds.every((id) => serverSet.has(id));
  });
}

export function reconcileUncertainSave(
  intendedProfiles: SaveRoleBranchProfileInput[],
  baselineRevision: string,
  authoritative: RoleBranchPermissionsDocument,
): UncertainSaveResolution {
  const matchesIntended = sameProfileSets(intendedProfiles, authoritative.profiles);
  if (
    matchesIntended &&
    authoritative.permissionMode === "BRANCH" &&
    authoritative.revision !== baselineRevision
  ) {
    return "APPLIED";
  }
  if (authoritative.revision !== baselineRevision) {
    return "CONFLICT";
  }
  return "NOT_APPLIED";
}

export function isUncertainSaveError(error: NormalizedApiError): boolean {
  return (
    error.status === 0 ||
    error.status === 504 ||
    error.code === "CLIENT_REQUEST_TIMEOUT" ||
    error.code === "GW.UPSTREAM.UNAVAILABLE"
  );
}

export function isAuthorityChangedError(error: NormalizedApiError): boolean {
  return (
    error.status === 403 ||
    error.code === "ROLE_BRANCH_OWNER_REQUIRED" ||
    error.code === "MISSING_REQUIRED_PERMISSIONS" ||
    error.code === "TENANT_WIDE_PERMISSION_REQUIRED" ||
    error.code === "BRANCH_PERMISSION_DENIED"
  );
}

export function resolveRoleBranchErrorText(
  error: NormalizedApiError | null | undefined,
  t: Dictionary,
): string | undefined {
  if (!error) return undefined;
  const customMap = t.coreIdentity.roleBranch.errors;
  if (error.code && Object.prototype.hasOwnProperty.call(customMap, error.code)) {
    return customMap[error.code];
  }
  return resolveCoreErrorText(error, t);
}

export function buildSavedReceiptLines(options: {
  savedDoc: RoleBranchPermissionsDocument;
  selectedCompanyIds: string[];
  branchesById: ReadonlyMap<string, ScopeBranchOption>;
  t: Dictionary;
  lang: Language;
}): string[] {
  const { savedDoc, selectedCompanyIds, branchesById, t, lang } = options;
  const savedCopy = t.coreIdentity.roleBranch.dialogs.saved;
  if (savedDoc.profiles.length === 0) {
    return [savedCopy.noProfilesSaved];
  }

  const nextTaxonomy = buildBranchCatalogueTaxonomy(savedDoc.catalogue);
  const includedSummaries = savedDoc.profiles.map((profile) => {
    const mode = classifyBranchAccessMode(profile.permissionIds, true, nextTaxonomy);
    return formatTemplate(savedCopy.branchSummaryItem, {
      branch: profile.branchName,
      mode: formatBranchAccessModeLabel(mode, t, lang),
    });
  });

  const lines: string[] = [includedSummaries.slice(0, 3).join(" · ")];
  const savedBranchSet = new Set(savedDoc.profiles.map((profile) => profile.branchId));
  const excludedInCompany = [...branchesById.values()].filter(
    (branch) => selectedCompanyIds.includes(branch.companyId) && !savedBranchSet.has(branch.id),
  );
  if (excludedInCompany.length > 0) {
    lines.push(
      formatTemplate(savedCopy.excludedSummaryItem, {
        branch: excludedInCompany[0].name,
      }),
    );
  }
  return lines;
}
