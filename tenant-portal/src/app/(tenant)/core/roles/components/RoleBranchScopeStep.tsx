"use client";

import { useMemo } from "react";
import { Building2, MapPinOff } from "lucide-react";
import {
  Badge,
  Card,
  Checkbox,
  Field,
  MultiSelect,
  type MultiSelectOption,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type {
  ScopeBranchOption,
  ScopeCompanyOption,
} from "../hooks/branch-permissions-review";

interface RoleBranchScopeStepProps {
  t: Dictionary;
  lang: Language;
  readOnly: boolean;
  companies: ScopeCompanyOption[];
  branches: ScopeBranchOption[];
  selectedCompanyIds: string[];
  onCompanySelectionChange: (nextIds: string[]) => void;
  draftProfiles: Readonly<Record<string, string[]>>;
  draftBranchIds: string[];
  onToggleBranch: (branchId: string) => void;
  autoSingleCompany: boolean;
  autoSingleBranchId: string | null;
  showScopeValidation: boolean;
  isClearingAllSaved: boolean;
  hasInactiveSelection: boolean;
  maxBranches: number;
}

export function RoleBranchScopeStep({
  t,
  lang,
  readOnly,
  companies,
  branches,
  selectedCompanyIds,
  onCompanySelectionChange,
  draftProfiles,
  draftBranchIds,
  onToggleBranch,
  autoSingleCompany,
  autoSingleBranchId,
  showScopeValidation,
  isClearingAllSaved,
  hasInactiveSelection,
  maxBranches,
}: RoleBranchScopeStepProps) {
  const scopeCopy = t.coreIdentity.roleBranch.scope;

  const companyOptions = useMemo<MultiSelectOption[]>(
    () =>
      companies.map((company) => ({
        value: company.id,
        label: company.isActive
          ? company.name
          : `${company.name} (${scopeCopy.inactiveSavedBadge})`,
        disabled: !company.isActive && !selectedCompanyIds.includes(company.id),
      })),
    [companies, scopeCopy.inactiveSavedBadge, selectedCompanyIds],
  );

  const selectedCompanies = useMemo(
    () =>
      selectedCompanyIds
        .map((id) => companies.find((company) => company.id === id))
        .filter((company): company is ScopeCompanyOption => company !== undefined),
    [companies, selectedCompanyIds],
  );

  const branchesByCompany = useMemo(() => {
    const grouped = new Map<string, ScopeBranchOption[]>();
    for (const company of selectedCompanies) {
      grouped.set(
        company.id,
        branches.filter((branch) => branch.companyId === company.id),
      );
    }
    return grouped;
  }, [branches, selectedCompanies]);

  const totalVisibleBranches = useMemo(
    () =>
      [...branchesByCompany.values()].reduce(
        (acc, companyBranches) => acc + companyBranches.length,
        0,
      ),
    [branchesByCompany],
  );

  const selectedCount = draftBranchIds.length;
  const branchCountBadgeText =
    selectedCount === 0
      ? scopeCopy.noBranchesSelected
      : selectedCount === 1
        ? scopeCopy.oneBranchSelected
        : selectedCount === 2
          ? scopeCopy.twoBranchesSelected
          : formatTemplate(scopeCopy.manyBranchesSelected, {
              count: formatNumber(selectedCount, lang),
            });

  const noCompanyError =
    showScopeValidation && selectedCompanyIds.length === 0 && !isClearingAllSaved
      ? scopeCopy.selectCompanyError
      : undefined;
  const noBranchError =
    showScopeValidation &&
    selectedCompanyIds.length > 0 &&
    selectedCount === 0 &&
    !isClearingAllSaved
      ? scopeCopy.selectBranchError
      : undefined;
  const overBranchCapError =
    selectedCount > maxBranches
      ? formatTemplate(scopeCopy.branchLimitError, {
          max: formatNumber(maxBranches, lang),
        })
      : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Field
        label={scopeCopy.allowedCompanies}
        required={!readOnly}
        showLabel
        error={noCompanyError}
        hint={
          selectedCompanyIds.length > 0
            ? autoSingleCompany
              ? scopeCopy.singleCompanyAutoHint
              : scopeCopy.companyFilterHint
            : undefined
        }
      >
        <MultiSelect textSize="compact"
          size="md"
          values={selectedCompanyIds}
          onValuesChange={onCompanySelectionChange}
          options={companyOptions}
          placeholder={scopeCopy.chooseCompanyPlaceholder}
          searchPlaceholder={scopeCopy.searchCompaniesPlaceholder}
          emptyLabel={scopeCopy.noCompaniesFound}
          moreLabel={scopeCopy.moreCompanies}
          removeLabel={scopeCopy.removeCompany}
          overflowLabel={scopeCopy.selectedCompaniesLabel}
          clearAllLabel={scopeCopy.clearCompanies}
          maxVisible={4}
          readOnly={readOnly}
          invalid={Boolean(noCompanyError)}
        />
      </Field>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {scopeCopy.allowedBranches}
            {!readOnly ? <span className="ms-1 text-destructive">*</span> : null}
          </span>
          <Badge tone={selectedCount > 0 ? "brand" : "neutral"} size="sm">
            {branchCountBadgeText}
          </Badge>
        </div>

        {selectedCompanyIds.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 border-dashed bg-muted/35 px-4 py-10 text-center">
            <Building2 className="size-9 text-muted-foreground" aria-hidden="true" />
            <p className="text-base font-medium text-foreground">{scopeCopy.noCompanyTitle}</p>
            <p className="max-w-md text-xs text-muted-foreground">
              {scopeCopy.noCompanyDescription}
            </p>
          </Card>
        ) : totalVisibleBranches === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 border-dashed bg-muted/35 px-4 py-10 text-center">
            <MapPinOff className="size-9 text-muted-foreground" aria-hidden="true" />
            <p className="text-base font-medium text-foreground">{scopeCopy.noBranchesTitle}</p>
            <p className="max-w-md text-xs text-muted-foreground">
              {scopeCopy.noBranchesDescription}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedCompanies.map((company) => {
              const companyBranches = branchesByCompany.get(company.id) ?? [];
              return (
                <Card
                  key={company.id}
                  className={
                    noBranchError
                      ? "overflow-hidden border-destructive p-0"
                      : "overflow-hidden p-0"
                  }
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/45 px-3.5 py-2">
                    <span className="text-sm font-medium text-foreground">
                      <bdi dir="auto">{company.name}</bdi>
                    </span>
                    {!company.isActive ? (
                      <Badge tone="caution" size="sm">
                        {scopeCopy.inactiveSavedBadge}
                      </Badge>
                    ) : null}
                  </div>
                  {companyBranches.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-muted-foreground">
                      {scopeCopy.noBranchesTitle}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {companyBranches.map((branch) => {
                        const checked = Object.prototype.hasOwnProperty.call(
                          draftProfiles,
                          branch.id,
                        );
                        const isSoleAuto = autoSingleBranchId === branch.id && checked;
                        return (
                          <li key={branch.id}>
                            <label
                              className={`flex items-start gap-3 px-3.5 py-2.5 transition-colors ${
                                readOnly ? "cursor-default" : "cursor-pointer hover:bg-muted/30"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => onToggleBranch(branch.id)}
                                disabled={readOnly || (!branch.isActive && !checked)}
                                aria-label={branch.name}
                                className="mt-0.5"
                              />
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-sm text-foreground ${
                                      checked ? "font-medium" : "font-normal"
                                    }`}
                                  >
                                    <bdi dir="auto">{branch.name}</bdi>
                                  </span>
                                  {!branch.isActive ? (
                                    <Badge tone="caution" size="sm">
                                      {scopeCopy.inactiveSavedBadge}
                                    </Badge>
                                  ) : null}
                                </span>
                                {isSoleAuto ? (
                                  <span className="text-xs text-muted-foreground">
                                    {scopeCopy.singleBranchAutoHint}
                                  </span>
                                ) : !branch.isActive && checked ? (
                                  <span className="text-xs text-muted-foreground">
                                    {scopeCopy.inactiveSavedHint}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {autoSingleBranchId && selectedCount === 1 ? (
          <p className="text-xs text-muted-foreground">{scopeCopy.singleBranchApplyHint}</p>
        ) : null}

        {isClearingAllSaved ? (
          <p
            role="status"
            className="rounded-md border border-border bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground"
          >
            {scopeCopy.removingAllProfilesHint}
          </p>
        ) : null}

        {hasInactiveSelection && !readOnly ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {scopeCopy.inactiveSelectionError}
          </p>
        ) : null}
        {noBranchError || overBranchCapError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {noBranchError ?? overBranchCapError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
