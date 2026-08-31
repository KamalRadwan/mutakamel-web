import type { CorePath } from "@/lib/api/envelope";
import { isNonEmptyString, isUuidV7, record } from "../core-validation";

// Taxes and numbering sequences are both optionally company-scoped, and both
// need the same two things: a picker of active companies, and a name to put in
// the duplicate-code conflict message so "code already exists" is not baffling.
//
// `GET /organization/companies` (permission `org.company.read`, documented in
// docs/api/core-identity.md) is the only listing of them. A caller without
// that permission still manages tenant-wide rows; the screens degrade to
// "tenant-wide only" rather than failing.
export const COMPANY_OPTIONS_PATH: CorePath =
  "/api/tenant/core/v1/organization/companies?status=ACTIVE&limit=100&sortBy=name&sortDir=ASC";

export interface CompanyOption {
  id: string;
  code: string;
  name: string;
}

/** Sentinel for the "no company — tenant-wide" choice; never sent to the server. */
export const TENANT_WIDE_COMPANY = "__tenant_wide__";

export function parseCompanyOptionsResponse(payload: unknown): CompanyOption[] {
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) {
    throw new Error("Invalid Core companies response.");
  }
  return page.items.map((item) => {
    const company = record(item);
    if (
      !company ||
      !isUuidV7(company.id) ||
      !isNonEmptyString(company.code, 32) ||
      !isNonEmptyString(company.name, 120)
    ) {
      throw new Error("Invalid Core companies response.");
    }
    return { id: company.id, code: company.code, name: company.name };
  });
}

export function companyLabel(
  companies: readonly CompanyOption[],
  companyId: string | null,
  tenantWideLabel: string,
): string {
  if (companyId === null) return tenantWideLabel;
  return companies.find((company) => company.id === companyId)?.name ?? companyId;
}
