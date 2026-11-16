"use client";

import { Button, Combobox, Field } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { RemoteOptions } from "../../hooks/useCoreOptions";
import {
  isRemoteOptionsEmpty,
  isRemoteOptionsForbidden,
  isSoleEligibleOption,
  type OrganizationCascadeResult,
} from "../../hooks/useOrganizationCascade";
import type { UserFormValues } from "../user-payloads";

interface UserPlacementFieldsProps {
  values: UserFormValues;
  cascade: OrganizationCascadeResult;
  users: RemoteOptions;
  canReadUsers: boolean;
  isSubmitting: boolean;
  companyError?: string;
  branchError?: string;
  departmentError?: string;
  onManagerChange: (managerId: string) => void;
}

function resolveCascadeHint(options: {
  parentSelected: boolean;
  chooseParentText?: string;
  level: RemoteOptions;
  forbiddenText: string;
  loadFailedText: string;
  singleOptionText?: string;
  noOptionsText: string;
  defaultHint?: string;
}): string | undefined {
  if (!options.parentSelected) return options.chooseParentText;
  if (isRemoteOptionsForbidden(options.level)) return options.forbiddenText;
  if (options.level.error) return options.loadFailedText;
  if (options.singleOptionText && isSoleEligibleOption(options.level)) {
    return options.singleOptionText;
  }
  if (isRemoteOptionsEmpty(options.level)) {
    return options.noOptionsText;
  }
  return options.defaultHint;
}

function selectedOptionLabel(
  level: RemoteOptions,
  id: string,
  loadingLabel: string,
  unavailableLabel: string,
): string | undefined {
  if (!id) return undefined;
  return level.labelFor(id) ?? (level.isLoading ? loadingLabel : unavailableLabel);
}

export function UserPlacementFields({
  values,
  cascade,
  users,
  canReadUsers,
  isSubmitting,
  companyError,
  branchError,
  departmentError,
  onManagerChange,
}: UserPlacementFieldsProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;

  const basePickerLabels = {
    placeholder: copy.picker.placeholder,
    searchPlaceholder: copy.picker.searchPlaceholder,
    loadingLabel: copy.picker.loading,
    emptyLabel: copy.picker.empty,
  };

  function renderLoadRetry(level: RemoteOptions) {
    if (!level.error || isRemoteOptionsForbidden(level) || !level.retry) return null;
    return (
      <Button
        variant="ghost"
        size="xs"
        onClick={level.retry}
        className="self-start"
      >
        {copy.cascade.retry}
      </Button>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.companies.parentLabel}
          hint={resolveCascadeHint({
            parentSelected: true,
            level: cascade.companies,
            forbiddenText: copy.errors.MISSING_REQUIRED_PERMISSIONS,
            loadFailedText: copy.cascade.loadFailed,
            singleOptionText: copy.cascade.singleOption,
            noOptionsText: copy.cascade.noOptions,
          })}
          error={companyError}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...basePickerLabels}
            value={values.companyId || undefined}
            selectedLabel={selectedOptionLabel(
              cascade.companies,
              values.companyId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={cascade.selectCompany}
            options={cascade.companies.options}
            onSearch={cascade.companies.search}
            loading={cascade.companies.isLoading}
            disabled={isSubmitting || isRemoteOptionsForbidden(cascade.companies)}
          />
        </Field>
        {renderLoadRetry(cascade.companies)}
      </div>

      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.branches.parentLabel}
          hint={resolveCascadeHint({
            parentSelected: Boolean(values.companyId),
            chooseParentText: copy.cascade.chooseCompanyFirst,
            level: cascade.branches,
            forbiddenText: copy.errors.MISSING_REQUIRED_PERMISSIONS,
            loadFailedText: copy.cascade.loadFailed,
            singleOptionText: copy.cascade.singleOption,
            noOptionsText: copy.cascade.noOptions,
            defaultHint: copy.users.branchHint,
          })}
          error={branchError}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...basePickerLabels}
            value={values.branchId || undefined}
            selectedLabel={selectedOptionLabel(
              cascade.branches,
              values.branchId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={cascade.selectBranch}
            options={cascade.branches.options}
            onSearch={cascade.branches.search}
            loading={cascade.branches.isLoading}
            disabled={
              isSubmitting ||
              !values.companyId ||
              isRemoteOptionsForbidden(cascade.branches)
            }
          />
        </Field>
        {renderLoadRetry(cascade.branches)}
      </div>

      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.departments.parentLabel}
          hint={resolveCascadeHint({
            parentSelected: Boolean(values.branchId),
            chooseParentText: copy.cascade.chooseBranchFirst,
            level: cascade.departments,
            forbiddenText: copy.errors.MISSING_REQUIRED_PERMISSIONS,
            loadFailedText: copy.cascade.loadFailed,
            singleOptionText: copy.cascade.singleOption,
            noOptionsText: copy.cascade.noOptions,
          })}
          error={departmentError}
          showLabel
          required
        >
          <Combobox textSize="compact"
            {...basePickerLabels}
            value={values.departmentId || undefined}
            selectedLabel={selectedOptionLabel(
              cascade.departments,
              values.departmentId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={cascade.selectDepartment}
            options={cascade.departments.options}
            onSearch={cascade.departments.search}
            loading={cascade.departments.isLoading}
            disabled={
              isSubmitting ||
              !values.branchId ||
              isRemoteOptionsForbidden(cascade.departments)
            }
          />
        </Field>
        {renderLoadRetry(cascade.departments)}
      </div>

      <div className="flex flex-col gap-1">
        <Field
          label={copy.levels.teams.parentLabel}
          hint={resolveCascadeHint({
            parentSelected: Boolean(values.departmentId),
            chooseParentText: copy.cascade.chooseDepartmentFirst,
            level: cascade.teams,
            forbiddenText: copy.errors.MISSING_REQUIRED_PERMISSIONS,
            loadFailedText: copy.cascade.loadFailed,
            noOptionsText: copy.cascade.noOptions,
          })}
          showLabel
        >
          <Combobox textSize="compact"
            {...basePickerLabels}
            clearLabel={copy.picker.clear}
            value={values.teamId || undefined}
            selectedLabel={selectedOptionLabel(
              cascade.teams,
              values.teamId,
              copy.picker.loading,
              copy.grants.nameUnavailable,
            )}
            onValueChange={cascade.selectTeam}
            options={cascade.teams.options}
            onSearch={cascade.teams.search}
            loading={cascade.teams.isLoading}
            disabled={
              isSubmitting ||
              !values.departmentId ||
              isRemoteOptionsForbidden(cascade.teams)
            }
          />
        </Field>
        {renderLoadRetry(cascade.teams)}
      </div>

      {canReadUsers ? (
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Field
            label={copy.users.manager}
            hint={
              isRemoteOptionsForbidden(users)
                ? copy.errors.MISSING_REQUIRED_PERMISSIONS
                : users.error
                  ? copy.cascade.loadFailed
                  : undefined
            }
            showLabel
          >
            <Combobox textSize="compact"
              {...basePickerLabels}
              clearLabel={copy.picker.clear}
              value={values.managerId || undefined}
              selectedLabel={selectedOptionLabel(
                users,
                values.managerId,
                copy.picker.loading,
                copy.grants.nameUnavailable,
              )}
              onValueChange={(next) => onManagerChange(next ?? "")}
              options={users.options}
              onSearch={users.search}
              loading={users.isLoading}
              disabled={isSubmitting || isRemoteOptionsForbidden(users)}
            />
          </Field>
          {renderLoadRetry(users)}
        </div>
      ) : null}
    </div>
  );
}
