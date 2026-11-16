import {
  USER_EMAIL_MAX_LENGTH,
  USER_EMPLOYEE_CODE_MAX_LENGTH,
  USER_JOB_TITLE_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  type InviteUserInput,
  type TenantUser,
  type UpdateUserInput,
} from "../contracts/user-contract";

export interface UserFormValues {
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  jobTitle: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId: string;
  managerId: string;
}

export const EMPTY_USER_FORM: UserFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  employeeCode: "",
  jobTitle: "",
  companyId: "",
  branchId: "",
  departmentId: "",
  teamId: "",
  managerId: "",
};

/** `CreateTenantUserDto.employeeCode` / `UpdateTenantUserDto.employeeCode` — `^[A-Za-z0-9._-]{1,32}$`. */
export const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;

/** Pragmatic client mirror of `@IsEmail()` before backend authoritative check. */
export const USER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function userToFormValues(user: TenantUser): UserFormValues {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    employeeCode: user.employeeCode ?? "",
    jobTitle: user.jobTitle ?? "",
    companyId: user.companyId,
    branchId: user.branchId,
    departmentId: user.departmentId,
    teamId: user.teamId ?? "",
    managerId: user.managerId ?? "",
  };
}

export function isUserFormValid(
  mode: "invite" | "edit",
  values: UserFormValues,
): boolean {
  const email = values.email.trim();
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const employeeCode = values.employeeCode.trim();
  const jobTitle = values.jobTitle.trim();

  if (mode === "invite") {
    if (
      email.length === 0 ||
      email.length > USER_EMAIL_MAX_LENGTH ||
      !USER_EMAIL_PATTERN.test(email)
    ) {
      return false;
    }
  }
  if (firstName.length === 0 || firstName.length > USER_NAME_MAX_LENGTH) return false;
  if (lastName.length === 0 || lastName.length > USER_NAME_MAX_LENGTH) return false;
  if (!values.companyId || !values.branchId || !values.departmentId) return false;
  if (
    employeeCode.length > 0 &&
    (employeeCode.length > USER_EMPLOYEE_CODE_MAX_LENGTH ||
      !EMPLOYEE_CODE_PATTERN.test(employeeCode))
  ) {
    return false;
  }
  if (jobTitle.length > USER_JOB_TITLE_MAX_LENGTH) return false;
  return true;
}

/**
 * `CreateTenantUserDto`: omits blank optional strings (`@IsOptional()` fails
 * `@Matches` / `@IsUUID('7')` when `""` is sent) and normalises email.
 */
export function toInviteInput(values: UserFormValues): InviteUserInput {
  const employeeCode = values.employeeCode.trim();
  const jobTitle = values.jobTitle.trim();
  return {
    email: values.email.trim().toLowerCase(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    companyId: values.companyId,
    branchId: values.branchId,
    departmentId: values.departmentId,
    ...(values.teamId ? { teamId: values.teamId } : {}),
    ...(values.managerId ? { managerId: values.managerId } : {}),
    ...(employeeCode ? { employeeCode } : {}),
    ...(jobTitle ? { jobTitle } : {}),
  };
}

/**
 * `UpdateTenantUserDto`: never includes `email` (`forbidNonWhitelisted`),
 * sends `null` for `teamId` and `managerId` only when cleared or changed from
 * the loaded value, and sends trimmed strings for `employeeCode` and `jobTitle`
 * (`@Transform` converts `""` to `null` before `@IsOptional()` so blank clears).
 */
export function toUpdateInput(
  loaded: TenantUser,
  draft: UserFormValues,
): UpdateUserInput {
  const nextTeam = draft.teamId || null;
  const nextManager = draft.managerId || null;
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    companyId: draft.companyId,
    branchId: draft.branchId,
    departmentId: draft.departmentId,
    employeeCode: draft.employeeCode.trim(),
    jobTitle: draft.jobTitle.trim(),
    ...(nextTeam !== loaded.teamId ? { teamId: nextTeam } : {}),
    ...(nextManager !== loaded.managerId ? { managerId: nextManager } : {}),
  };
}
