import type {
  OrgLevel,
  OrgNodeOf,
  OrgNodeStatus,
} from "../contracts/organization-contract";
import { ORG_LEVEL_CONFIG, ORG_PARENT_BODY_KEY } from "./level-config";

/** `CreateCompanyDto` / `CreateBranchDto` / `CreateDepartmentDto` / `CreateTeamDto` code pattern. */
export const ORG_CODE_PATTERN = /^[A-Z0-9_-]{1,32}$/u;
/** `CreateCompanyDto` / `UpdateCompanyDto` three-letter ISO currency code pattern. */
export const ORG_CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface OrgNodeFormValues {
  code: string;
  name: string;
  /** Direct parent ID compatibility field; synced with companyId / branchId / departmentId. */
  parentId: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  status: OrgNodeStatus;
  legalName: string;
  taxNumber: string;
  currencyCode: string;
  address: string;
  phone: string;
  isHeadquarters: boolean;
  leadUserId: string;
}

export const EMPTY_ORG_NODE_FORM: OrgNodeFormValues = {
  code: "",
  name: "",
  parentId: "",
  companyId: "",
  branchId: "",
  departmentId: "",
  status: "ACTIVE",
  legalName: "",
  taxNumber: "",
  currencyCode: "",
  address: "",
  phone: "",
  isHeadquarters: false,
  leadUserId: "",
};

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stripUndefined(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

export function resolveDirectParentId(level: OrgLevel, values: OrgNodeFormValues): string {
  if (level === "branches") return (values.companyId || values.parentId).trim();
  if (level === "departments") return (values.branchId || values.parentId).trim();
  if (level === "teams") return (values.departmentId || values.parentId).trim();
  return "";
}

/** True when a company record already persists a 3-letter currency code that cannot be cleared. */
export function hasSavedCompanyCurrency(
  currencyCode: string | null | undefined,
): boolean {
  return typeof currencyCode === "string" && currencyCode.trim().length > 0;
}

/**
 * Only the keys the DTO declares are sent. Core runs `forbidNonWhitelisted`, so
 * a stray key (`companyId` on department create, `companyId`/`branchId` on team
 * create) is a 400 rather than a silent ignore.
 */
export function buildCreateBody(level: OrgLevel, values: OrgNodeFormValues): Record<string, unknown> {
  const config = ORG_LEVEL_CONFIG[level];
  const body: Record<string, unknown> = {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
  };

  if (level !== "companies") {
    body[ORG_PARENT_BODY_KEY[level]] = resolveDirectParentId(level, values);
  }

  if (config.fields.includes("legalName")) body.legalName = optionalText(values.legalName);
  if (config.fields.includes("taxNumber")) body.taxNumber = optionalText(values.taxNumber);
  if (config.fields.includes("currencyCode")) {
    body.currencyCode = optionalText(values.currencyCode.toUpperCase());
  }
  if (config.fields.includes("address")) body.address = optionalText(values.address);
  if (config.fields.includes("phone")) body.phone = optionalText(values.phone);
  if (config.fields.includes("isHeadquarters")) body.isHeadquarters = values.isHeadquarters;
  if (config.fields.includes("leadUserId")) body.leadUserId = optionalText(values.leadUserId);
  return stripUndefined(body);
}

/**
 * Update DTOs clear optional text with `""` and team `leadUserId` with `null`.
 * `UpdateCompanyDto.currencyCode` (`@IsOptional() @Length(3, 3)`) is omitted when
 * blank so legacy companies with `currencyCode: null` can be edited without
 * forcing a currency; clearing an already-saved currency is blocked by validation
 * and write-dispatch checks.
 */
export function buildUpdateBody(level: OrgLevel, values: OrgNodeFormValues): Record<string, unknown> {
  const config = ORG_LEVEL_CONFIG[level];
  const body: Record<string, unknown> = {
    name: values.name.trim(),
    status: values.status,
  };
  if (config.fields.includes("legalName")) body.legalName = values.legalName.trim();
  if (config.fields.includes("taxNumber")) body.taxNumber = values.taxNumber.trim();
  if (config.fields.includes("currencyCode")) {
    body.currencyCode = optionalText(values.currencyCode.toUpperCase());
  }
  if (config.fields.includes("address")) body.address = values.address.trim();
  if (config.fields.includes("phone")) body.phone = values.phone.trim();
  if (config.fields.includes("isHeadquarters")) body.isHeadquarters = values.isHeadquarters;
  if (config.fields.includes("leadUserId")) body.leadUserId = optionalText(values.leadUserId) ?? null;
  return stripUndefined(body);
}

export function nodeToFormValues<L extends OrgLevel>(node: OrgNodeOf<L>): OrgNodeFormValues {
  const companyId = "companyId" in node ? node.companyId : "";
  const branchId = "branchId" in node ? node.branchId : "";
  const departmentId = "departmentId" in node ? node.departmentId : "";
  return {
    ...EMPTY_ORG_NODE_FORM,
    code: node.code,
    name: node.name,
    parentId: companyId || branchId || departmentId,
    companyId,
    branchId,
    departmentId,
    status: node.status,
    legalName: "legalName" in node ? (node.legalName ?? "") : "",
    taxNumber: "taxNumber" in node ? (node.taxNumber ?? "") : "",
    currencyCode: "currencyCode" in node ? (node.currencyCode ?? "") : "",
    address: "address" in node ? (node.address ?? "") : "",
    phone: "phone" in node ? (node.phone ?? "") : "",
    isHeadquarters: "isHeadquarters" in node ? node.isHeadquarters : false,
    leadUserId: "leadUserId" in node ? (node.leadUserId ?? "") : "",
  };
}
