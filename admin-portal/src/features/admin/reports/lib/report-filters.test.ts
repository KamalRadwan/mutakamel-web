import { describe, expect, it } from "vitest";
import {
  buildProvisioningQuery,
  buildTenantQuery,
  buildWindowQuery,
  copyDefaultReportFilters,
  dateInputToIso,
  formatDecimalString,
  isValidDateInput,
  validateReportFilters,
} from "./report-filters";

describe("report filter validation", () => {
  it("rejects impossible calendar days and reversed windows", () => {
    const draft = copyDefaultReportFilters().OVERVIEW;
    draft.from = "2026-02-30";
    expect(validateReportFilters("OVERVIEW", draft)).toEqual({
      from: "INVALID_FROM",
    });

    draft.from = "2026-08-13";
    draft.to = "2026-08-12";
    expect(validateReportFilters("OVERVIEW", draft)).toEqual({
      dateRange: "RANGE_REVERSED",
    });
    expect(isValidDateInput("2024-02-29")).toBe(true);
  });

  it("requires the tenant server filter to be UUID v7", () => {
    const draft = copyDefaultReportFilters().TENANTS;
    draft.serverId = "019f0000-0000-4000-8000-000000000001";
    expect(validateReportFilters("TENANTS", draft)).toMatchObject({
      serverId: "INVALID_SERVER_UUID_V7",
    });

    draft.serverId = "019f0000-0000-7000-8000-000000000001";
    expect(validateReportFilters("TENANTS", draft)).toEqual({});
  });

  it("bounds tenant and provisioning limits to supported API values", () => {
    const draft = copyDefaultReportFilters().PROVISIONING;
    draft.limit = "21";
    expect(validateReportFilters("PROVISIONING", draft)).toEqual({
      limit: "INVALID_LIMIT",
    });

    draft.limit = "100";
    expect(validateReportFilters("PROVISIONING", draft)).toEqual({});
  });

  it("builds inclusive UTC day boundaries without locale conversion", () => {
    const draft = copyDefaultReportFilters().BILLING;
    draft.from = "2026-08-01";
    draft.to = "2026-08-12";

    expect(buildWindowQuery(draft)).toEqual({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-12T23:59:59.999Z",
    });
    expect(dateInputToIso("2026-08-12", "END")).toBe(
      "2026-08-12T23:59:59.999Z",
    );
  });

  it("builds only the query fields currently honored by each service", () => {
    const tenantDraft = copyDefaultReportFilters().TENANTS;
    tenantDraft.status = "ACTIVE";
    tenantDraft.serverId = "019F0000-0000-7000-8000-000000000001";
    tenantDraft.limit = "25";
    expect(buildTenantQuery(tenantDraft, 2)).toEqual({
      page: 2,
      limit: 25,
      status: "ACTIVE",
      serverId: "019f0000-0000-7000-8000-000000000001",
    });

    const provisioningDraft = copyDefaultReportFilters().PROVISIONING;
    provisioningDraft.from = "2026-08-01";
    provisioningDraft.limit = "50";
    expect(buildProvisioningQuery(provisioningDraft)).toEqual({
      from: "2026-08-01T00:00:00.000Z",
      limit: 50,
    });
  });

  it("formats decimal strings without converting through binary numbers", () => {
    expect(formatDecimalString("123456789012345.6789")).toBe(
      "123,456,789,012,345.6789",
    );
  });
});
