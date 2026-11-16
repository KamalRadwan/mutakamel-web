"use client";

import { Search, SearchX, ShieldOff } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type {
  RoleBranchCatalogueItem,
  RoleRecordScope,
} from "../contracts/role-branch-contract";
import {
  formatBranchAccessModeLabel,
  type BranchAccessModeSummary,
  type ScopeBranchOption,
} from "../hooks/branch-permissions-review";
import type { BranchPermissionFilterMode } from "../hooks/branch-permissions-selection";
import type {
  BranchActionRow,
  BranchModuleNode,
} from "../hooks/branch-permissions-taxonomy";
import { GLOBAL_VIEW_BRANCH_ID } from "../hooks/useRoleBranchDraftState";
import {
  RoleBranchModuleAccordion,
  RoleBranchWorkspaceLockedSection,
} from "./RoleBranchModuleAccordion";

interface RoleBranchTreeStepProps {
  t: Dictionary;
  lang: Language;
  readOnly: boolean;
  isLoading: boolean;
  showGlobalOption: boolean;
  branches: ScopeBranchOption[];
  selectedCompanyIds: string[];
  draftProfiles: Readonly<Record<string, string[]>>;
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
  isActiveBranchIncluded: boolean;
  activePermissionIds: string[];
  activeSelectedSet: ReadonlySet<string>;
  activeBranchMode: BranchAccessModeSummary;
  maxPerBranch: number;
  filteredModules: BranchModuleNode[];
  tenantLockedItems: RoleBranchCatalogueItem[];
  showWorkspaceLocked: boolean;
  onToggleWorkspaceLocked: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  filterMode: BranchPermissionFilterMode;
  onFilterModeChange: (mode: BranchPermissionFilterMode) => void;
  onToggleActionRow: (row: BranchActionRow) => void;
  onChangeRecordScope: (row: BranchActionRow, scope: RoleRecordScope) => void;
  onToggleCollection: (rows: BranchActionRow[]) => void;
  onEditSelectedBranches: () => void;
}

export function RoleBranchTreeStep({
  t,
  lang,
  readOnly,
  isLoading,
  showGlobalOption,
  branches,
  selectedCompanyIds,
  draftProfiles,
  activeBranchId,
  onSelectBranch,
  isActiveBranchIncluded,
  activePermissionIds,
  activeSelectedSet,
  activeBranchMode,
  maxPerBranch,
  filteredModules,
  tenantLockedItems,
  showWorkspaceLocked,
  onToggleWorkspaceLocked,
  searchQuery,
  onSearchChange,
  onClearSearch,
  filterMode,
  onFilterModeChange,
  onToggleActionRow,
  onChangeRecordScope,
  onToggleCollection,
  onEditSelectedBranches,
}: RoleBranchTreeStepProps) {
  const roleBranchCopy = t.coreIdentity.roleBranch;
  const permCopy = roleBranchCopy.permissions;
  const selectorBranches = branches.filter(
    (branch) =>
      readOnly ||
      selectedCompanyIds.includes(branch.companyId) ||
      Object.prototype.hasOwnProperty.call(draftProfiles, branch.id),
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Field label={readOnly ? permCopy.viewedBranch : permCopy.currentBranch} showLabel>
        <Select value={activeBranchId} onValueChange={onSelectBranch}>
          <SelectTrigger textSize="compact" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent textSize="compact">
            {showGlobalOption ? (
              <SelectItem value={GLOBAL_VIEW_BRANCH_ID}>{roleBranchCopy.scopeGlobal}</SelectItem>
            ) : null}
            {selectorBranches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {formatTemplate(permCopy.branchOptionLabel, {
                  branch: branch.name,
                  company: branch.companyName,
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isLoading ? (
        <div className="flex flex-col gap-2.5 py-2" role="status" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <p className="pt-1 text-xs text-muted-foreground">{permCopy.loading}</p>
        </div>
      ) : !isActiveBranchIncluded ? (
        <Card className="flex flex-col items-center justify-center gap-2.5 bg-muted/35 px-4 py-12 text-center">
          <ShieldOff className="size-11 text-muted-foreground" aria-hidden="true" />
          <p className="text-lg font-medium text-foreground">{permCopy.excludedTitle}</p>
          <p className="max-w-md text-sm text-muted-foreground">{permCopy.excludedDescription}</p>
          <p className="max-w-md text-xs text-muted-foreground">{permCopy.excludedUnionHint}</p>
          {!readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onEditSelectedBranches}
              className="mt-1"
            >
              {permCopy.editSelectedBranches}
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge tone={activeBranchMode.kind === "EMPTY" ? "neutral" : "brand"} size="sm">
                {formatBranchAccessModeLabel(activeBranchMode, t, lang)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {activeBranchId === GLOBAL_VIEW_BRANCH_ID
                  ? roleBranchCopy.scopeGlobal
                  : permCopy.withinBranchOnly}
              </span>
            </div>
            {activeBranchId !== GLOBAL_VIEW_BRANCH_ID ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTemplate(permCopy.selectedCounter, {
                  count: formatNumber(activePermissionIds.length, lang),
                  max: formatNumber(maxPerBranch, lang),
                })}
              </span>
            ) : null}
          </div>

          {activeBranchId !== GLOBAL_VIEW_BRANCH_ID && activePermissionIds.length > maxPerBranch ? (
            <p
              role="alert"
              className="rounded-md bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground"
            >
              {formatTemplate(permCopy.overBranchLimit, {
                max: formatNumber(maxPerBranch, lang),
              })}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                size="sm"
                type="search"
                aria-label={permCopy.searchPlaceholder}
                placeholder={permCopy.searchPlaceholder}
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="ps-8"
              />
            </div>
            <div className="w-full sm:w-56">
              <Select
                value={filterMode}
                onValueChange={(val) => onFilterModeChange(val as BranchPermissionFilterMode)}
              >
                <SelectTrigger size="sm" aria-label={permCopy.filterLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{permCopy.filters.all}</SelectItem>
                  <SelectItem value="selected">{permCopy.filters.selected}</SelectItem>
                  <SelectItem value="view">{permCopy.filters.view}</SelectItem>
                  <SelectItem value="scoped">{permCopy.filters.scoped}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredModules.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-2 bg-muted/35 px-4 py-10 text-center">
              <SearchX className="size-9 text-muted-foreground" aria-hidden="true" />
              <p className="text-base font-medium text-foreground">{permCopy.searchEmptyTitle}</p>
              <p className="text-xs text-muted-foreground">{permCopy.searchEmptyDescription}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onClearSearch();
                  onFilterModeChange("all");
                }}
              >
                {permCopy.clearSearch}
              </Button>
            </Card>
          ) : (
            <RoleBranchModuleAccordion
              t={t}
              lang={lang}
              readOnly={readOnly}
              modules={filteredModules}
              activeSelectedSet={activeSelectedSet}
              onToggleActionRow={onToggleActionRow}
              onChangeRecordScope={onChangeRecordScope}
              onToggleCollection={onToggleCollection}
            />
          )}
        </>
      )}

      <RoleBranchWorkspaceLockedSection
        t={t}
        lang={lang}
        items={tenantLockedItems}
        expanded={showWorkspaceLocked}
        onToggleExpanded={onToggleWorkspaceLocked}
      />
    </div>
  );
}
