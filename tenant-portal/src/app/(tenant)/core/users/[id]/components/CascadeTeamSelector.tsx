"use client";

import { Button, Combobox, Field } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { RemoteOptions } from "../../../hooks/useCoreOptions";
import {
  isRemoteOptionsEmpty,
  isRemoteOptionsForbidden,
  isSoleEligibleOption,
  type OrganizationCascadeResult,
} from "../../../hooks/useOrganizationCascade";
import type { TeamPickerCascadeState } from "../hooks/useTeamMembershipModalForm";

function selectedLabel(
  level: RemoteOptions,
  id: string,
  loadingText: string,
  unavailableText: string,
  fallback?: string,
): string | undefined {
  if (!id) return undefined;
  return (
    level.labelFor(id) ??
    fallback ??
    (level.isLoading ? loadingText : unavailableText)
  );
}

function stepHint(
  level: RemoteOptions,
  waitingHint: string | undefined,
  forbiddenText: string,
  loadFailedText: string,
  singleOptionText: string,
  noOptionsText: string,
): string | undefined {
  if (waitingHint) return waitingHint;
  if (isRemoteOptionsForbidden(level)) return forbiddenText;
  if (level.error) return loadFailedText;
  if (isSoleEligibleOption(level)) return singleOptionText;
  if (isRemoteOptionsEmpty(level)) return noOptionsText;
  return undefined;
}

interface CascadeTeamSelectorProps {
  canCascade: boolean;
  state: TeamPickerCascadeState;
  cascade: OrganizationCascadeResult;
  fallbackTeams: RemoteOptions;
  disabled: boolean;
  onFallbackTeamChange: (teamId: string) => void;
}

export function CascadeTeamSelector({
  canCascade,
  state,
  cascade,
  fallbackTeams,
  disabled,
  onFallbackTeamChange,
}: CascadeTeamSelectorProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;

  const pickerLabels = {
    placeholder: copy.picker.placeholder,
    searchPlaceholder: copy.picker.searchPlaceholder,
    loadingLabel: copy.picker.loading,
    emptyLabel: copy.picker.empty,
  };

  function renderRetry(level: RemoteOptions) {
    if (!level.error || isRemoteOptionsForbidden(level) || !level.retry) return null;
    return (
      <Button variant="ghost" size="xs" onClick={level.retry} className="self-start">
        {copy.cascade.retry}
      </Button>
    );
  }

  if (!canCascade) {
    return (
      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.teams.singular}
          hint={stepHint(
            fallbackTeams,
            undefined,
            copy.errors.MISSING_REQUIRED_PERMISSIONS,
            copy.cascade.loadFailed,
            copy.cascade.singleOption,
            copy.cascade.noOptions,
          )}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...pickerLabels}
            placeholder={copy.memberships.addTeam}
            value={state.teamId || undefined}
            selectedLabel={selectedLabel(
              fallbackTeams,
              state.teamId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={(next) => onFallbackTeamChange(next ?? "")}
            options={fallbackTeams.options}
            onSearch={fallbackTeams.search}
            loading={fallbackTeams.isLoading}
            disabled={disabled || isRemoteOptionsForbidden(fallbackTeams)}
          />
        </Field>
        {renderRetry(fallbackTeams)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.companies.singular}
          hint={stepHint(
            cascade.companies,
            undefined,
            copy.errors.MISSING_REQUIRED_PERMISSIONS,
            copy.cascade.loadFailed,
            copy.cascade.singleOption,
            copy.cascade.noOptions,
          )}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...pickerLabels}
            value={state.companyId || undefined}
            selectedLabel={selectedLabel(
              cascade.companies,
              state.companyId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={cascade.selectCompany}
            options={cascade.companies.options}
            onSearch={cascade.companies.search}
            loading={cascade.companies.isLoading}
            disabled={disabled || isRemoteOptionsForbidden(cascade.companies)}
          />
        </Field>
        {renderRetry(cascade.companies)}
      </div>

      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.branches.singular}
          hint={stepHint(
            cascade.branches,
            state.companyId ? undefined : copy.cascade.chooseCompanyFirst,
            copy.errors.MISSING_REQUIRED_PERMISSIONS,
            copy.cascade.loadFailed,
            copy.cascade.singleOption,
            copy.cascade.noOptions,
          )}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...pickerLabels}
            value={state.branchId || undefined}
            selectedLabel={selectedLabel(
              cascade.branches,
              state.branchId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={cascade.selectBranch}
            options={cascade.branches.options}
            onSearch={cascade.branches.search}
            loading={cascade.branches.isLoading}
            disabled={
              disabled ||
              !state.companyId ||
              isRemoteOptionsForbidden(cascade.branches)
            }
          />
        </Field>
        {renderRetry(cascade.branches)}
      </div>

      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.departments.singular}
          hint={stepHint(
            cascade.departments,
            state.branchId ? undefined : copy.cascade.chooseBranchFirst,
            copy.errors.MISSING_REQUIRED_PERMISSIONS,
            copy.cascade.loadFailed,
            copy.cascade.singleOption,
            copy.cascade.noOptions,
          )}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...pickerLabels}
            value={state.departmentId || undefined}
            selectedLabel={selectedLabel(
              cascade.departments,
              state.departmentId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={cascade.selectDepartment}
            options={cascade.departments.options}
            onSearch={cascade.departments.search}
            loading={cascade.departments.isLoading}
            disabled={
              disabled ||
              !state.branchId ||
              isRemoteOptionsForbidden(cascade.departments)
            }
          />
        </Field>
        {renderRetry(cascade.departments)}
      </div>

      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.teams.singular}
          hint={stepHint(
            cascade.teams,
            state.departmentId ? undefined : copy.cascade.chooseDepartmentFirst,
            copy.errors.MISSING_REQUIRED_PERMISSIONS,
            copy.cascade.loadFailed,
            copy.cascade.singleOption,
            copy.cascade.noOptions,
          )}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...pickerLabels}
            placeholder={copy.memberships.addTeam}
            value={state.teamId || undefined}
            selectedLabel={selectedLabel(
              cascade.teams,
              state.teamId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
              fallbackTeams.labelFor(state.teamId),
            )}
            onValueChange={cascade.selectTeam}
            options={cascade.teams.options}
            onSearch={cascade.teams.search}
            loading={cascade.teams.isLoading}
            disabled={
              disabled ||
              !state.departmentId ||
              isRemoteOptionsForbidden(cascade.teams)
            }
          />
        </Field>
        {renderRetry(cascade.teams)}
      </div>
    </div>
  );
}
