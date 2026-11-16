import { readCorePage, type CorePath } from "@/lib/api/envelope";
import {
  buildCoreListQuery,
  CORE_MAX_PAGE_LIMIT,
  invalidCoreResponse,
  parseCorePage,
  record,
  requiredText,
  requiredUuidV7,
  type CorePage,
} from "../contracts/core-page";

// Taxes and numbering sequences are both optionally company-scoped, and both
// need the same two things: a picker of active companies, and a name to put in
// the duplicate-code conflict message so "code already exists" is not baffling.
//
// `GET /organization/companies` (permission `org.company.read`, documented in
// docs/api/core-identity.md) is the only listing of them. A caller without
// that permission still manages tenant-wide rows; screens explain the missing
// company choices and offer retry without hiding their settings table.
const COMPANY_OPTIONS_PATH: CorePath = "/api/tenant/core/v1/organization/companies";

// CreateCompanyDto — core-app/src/tenant/organization/dto/create-company.dto.ts.
const COMPANY_CODE_MAX_LENGTH = 32;
const COMPANY_NAME_MAX_LENGTH = 120;

// AUDIT29X-TPK-1: bounded sequential reads, 100 companies per request.
const COMPANY_OPTIONS_LIMIT = 1_000;
const COMPANY_OPTIONS_RESPONSE_LIMIT_BYTES = 400_000;

export interface CompanyOption {
  id: string;
  code: string;
  name: string;
}

/** Sentinel for the "no company — tenant-wide" choice; never sent to the server. */
export const TENANT_WIDE_COMPANY = "__tenant_wide__";

export function parseCompanyOption(payload: unknown): CompanyOption {
  const company = record(payload);
  if (!company) invalidCoreResponse();
  return {
    id: requiredUuidV7(company, "id"),
    code: requiredText(company, "code", COMPANY_CODE_MAX_LENGTH),
    name: requiredText(company, "name", COMPANY_NAME_MAX_LENGTH),
  };
}

export function parseCompanyOptionsPage(
  envelope: { data: unknown; meta: unknown },
  expectedPage = 1,
): CorePage<CompanyOption> {
  const page = parseCorePage(envelope, parseCompanyOption);
  if (page.page !== expectedPage || page.limit !== CORE_MAX_PAGE_LIMIT) {
    invalidCoreResponse();
  }
  return page;
}

export async function loadCompanyOptions(signal: AbortSignal): Promise<{
  companies: CompanyOption[];
  isTruncated: boolean;
}> {
  const companies: CompanyOption[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const query = buildCoreListQuery({
      page,
      search: "",
      sortBy: "name",
      sortDir: "ASC",
      limit: CORE_MAX_PAGE_LIMIT,
      filters: { status: "ACTIVE" },
    });
    const envelope = await readCorePage(COMPANY_OPTIONS_PATH, query, {
      signal,
      cache: "no-store",
      suppressForbiddenToast: true,
      maxResponseBytes: COMPANY_OPTIONS_RESPONSE_LIMIT_BYTES,
    });
    signal.throwIfAborted();
    const parsed = parseCompanyOptionsPage(envelope, page);
    for (const item of parsed.items) {
      if (seenIds.has(item.id)) invalidCoreResponse();
      seenIds.add(item.id);
      companies.push(item);
    }
    if (companies.length >= parsed.total || companies.length >= COMPANY_OPTIONS_LIMIT) {
      return { companies, isTruncated: companies.length < parsed.total };
    }
    // A short page before total is reached cannot be treated as a complete picker.
    if (parsed.items.length !== CORE_MAX_PAGE_LIMIT || !parsed.hasNext) {
      invalidCoreResponse();
    }
  }
}

export function companyLabel(
  companies: readonly CompanyOption[],
  companyId: string | null,
  tenantWideLabel: string,
  unknownCompanyLabel: string,
): string {
  if (companyId === null) return tenantWideLabel;
  return companies.find((company) => company.id === companyId)?.name ?? unknownCompanyLabel;
}
