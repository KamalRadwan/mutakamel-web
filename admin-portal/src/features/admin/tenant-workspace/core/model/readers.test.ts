import { describe, expect, it } from "vitest";
import {
  CUSTOM_FQDN_ID,
  NEXT_UPDATED_AT,
  OPERATION_ID,
  PLATFORM_FQDN_ID,
  STORAGE_ID,
  TENANT_ID,
  UPDATED_AT,
  customFqdnFixture,
  tenantFixture,
  tenantPayload,
} from "../__tests__/fixtures";
import {
  buildUpdateTenantProfileDto,
  canAttachAfterPreflight,
  canPromoteLegacyPrimary,
  createTenantProfileDraft,
  hasPlatformPrimaryFqdn,
  isTenantDatabaseReady,
  platformFqdnForTenant,
  readFqdnAvailability,
  readTenantFqdn,
  readTenantFqdnList,
  readTenantProvisioningCommandResult,
  readTenantView,
  replaceTenantFqdn,
} from "./readers";

describe("tenant core response readers", () => {
  it("parses the exact tenant projection and retains only safe storage fields", () => {
    const parsed = readTenantView(tenantPayload());

    expect(parsed).toMatchObject({
      id: TENANT_ID,
      status: "ACTIVE",
      storageServerId: STORAGE_ID,
      storageServer: {
        id: STORAGE_ID,
        code: "garage-cairo-1",
        name: "Garage Cairo",
        region: "af-cairo-1",
        status: "ACTIVE",
      },
    });
    expect(parsed.storageServer).not.toHaveProperty("bucketName");
    expect(parsed.storageServer).not.toHaveProperty("endpoint");
    expect(parsed.storageServer).not.toHaveProperty("accessKeyId");
  });

  it.each([
    [
      "tenant status",
      (value: Record<string, unknown>) => (value.status = "FAILED"),
    ],
    ["tenant id", (value: Record<string, unknown>) => (value.id = "not-a-v7")],
    [
      "storage status",
      (value: Record<string, unknown>) => {
        (value.storageServer as Record<string, unknown>).status = "DELETED";
      },
    ],
    [
      "storage identity",
      (value: Record<string, unknown>) => {
        (value.storageServer as Record<string, unknown>).id =
          "019ff251-7777-7777-8777-777777777777";
      },
    ],
  ])("rejects an invalid %s", (_label, mutate) => {
    const value = tenantPayload();
    mutate(value);
    expect(() => readTenantView(value)).toThrow();
  });

  it("rejects multiple primary domains", () => {
    const value = tenantPayload();
    value.fqdns = [
      ...(value.fqdns as unknown[]),
      { ...customFqdnFixture(), isPrimary: true },
    ];
    expect(() => readTenantView(value)).toThrow(
      "INVALID_TENANT_DETAIL_RESPONSE",
    );
  });

  it("normalizes domains and rejects malformed FQDN rows", () => {
    expect(
      readTenantFqdn({
        ...customFqdnFixture(),
        fqdn: "Portal.Example.COM",
      }).fqdn,
    ).toBe("portal.example.com");
    expect(() =>
      readTenantFqdn({ ...customFqdnFixture(), fqdn: "bad_domain" }),
    ).toThrow("INVALID_TENANT_FQDN_RESPONSE");
    expect(() =>
      readTenantFqdn({
        ...customFqdnFixture(),
        validationStatus: "UNKNOWN",
      }),
    ).toThrow("INVALID_TENANT_FQDN_RESPONSE");
  });

  it("reads a bounded unique FQDN collection with at most one primary", () => {
    const primary = (tenantPayload().fqdns as unknown[])[0];
    const secondary = customFqdnFixture();
    expect(readTenantFqdnList([primary, secondary])).toHaveLength(2);
    expect(() => readTenantFqdnList([secondary, secondary])).toThrow(
      "INVALID_TENANT_FQDN_LIST_RESPONSE",
    );
    expect(() =>
      readTenantFqdnList([primary, { ...secondary, isPrimary: true }]),
    ).toThrow("INVALID_TENANT_FQDN_LIST_RESPONSE");
  });

  it("strictly reads available, pending-DNS, and unavailable preflight evidence", () => {
    expect(
      readFqdnAvailability({
        fqdn: "Portal.Example.COM",
        valid: false,
        available: true,
        dnsResolved: false,
        reachable: false,
        reason: "DNS_NOT_FOUND",
        message: "DNS not ready",
      }),
    ).toEqual({
      fqdn: "portal.example.com",
      valid: false,
      available: true,
      dnsResolved: false,
      reachable: false,
      reason: "DNS_NOT_FOUND",
      message: "DNS not ready",
    });
    expect(() =>
      readFqdnAvailability({
        fqdn: "portal.example.com",
        valid: true,
        available: true,
        reason: "SOMETHING_ELSE",
        message: "bad",
      }),
    ).toThrow("INVALID_FQDN_PREFLIGHT_RESPONSE");
    expect(
      readFqdnAvailability({
        fqdn: "ERP_Mersany.com",
        valid: false,
        available: false,
        reason: "INVALID_FORMAT",
        message: "Enter a valid domain",
      }),
    ).toEqual({
      fqdn: "erp_mersany.com",
      valid: false,
      available: false,
      reason: "INVALID_FORMAT",
      message: "Enter a valid domain",
    });
  });

  it("reads compatibility provisioning command evidence", () => {
    expect(
      readTenantProvisioningCommandResult({
        replayed: false,
        operation: {
          id: OPERATION_ID,
          tenantId: TENANT_ID,
          generation: 2,
          type: "ADD_APPLICATION",
          status: "QUEUED",
          currentPhase: "PLAN",
          updatedAt: UPDATED_AT,
        },
      }),
    ).toEqual({
      replayed: false,
      operation: {
        id: OPERATION_ID,
        tenantId: TENANT_ID,
        generation: 2,
        type: "ADD_APPLICATION",
        status: "QUEUED",
        currentPhase: "PLAN",
        updatedAt: UPDATED_AT,
      },
    });
  });
});

describe("tenant profile and lifecycle model", () => {
  it.each([
    ["PROVISIONING", false],
    ["PROVISIONING_FAILED", false],
    ["ACTIVE", true],
    ["SUSPENDED", true],
    ["DELETED", false],
  ] as const)("maps %s tenant-database readiness", (status, ready) => {
    expect(isTenantDatabaseReady({ status })).toBe(ready);
  });

  it("creates one nullable-safe draft and emits explicit null clears", () => {
    const tenant = tenantFixture("ACTIVE", { address: null, phone: null });
    const draft = createTenantProfileDraft(tenant);
    const dto = buildUpdateTenantProfileDto(
      {
        ...draft,
        companyName: "  Acme International  ",
        countryIsoCode: "eg",
        industry: " ",
        phone: " ",
        address: { city: " ", street1: " " },
      },
      UPDATED_AT,
    );

    expect(dto).toEqual({
      expectedUpdatedAt: UPDATED_AT,
      companyName: "Acme International",
      countryName: "Egypt",
      countryIsoCode: "EG",
      industry: null,
      timezone: "Africa/Cairo",
      phoneCountryCode: "+20",
      phone: null,
      address: null,
      taxNumber: "TAX-1",
      commercialRegistrationNumber: "CR-1",
    });
  });

  it("rejects an unusable profile draft or concurrency token", () => {
    const draft = createTenantProfileDraft(tenantFixture());
    expect(() =>
      buildUpdateTenantProfileDto({ ...draft, companyName: " " }, UPDATED_AT),
    ).toThrow("INVALID_TENANT_PROFILE_DRAFT");
    expect(() => buildUpdateTenantProfileDto(draft, "yesterday")).toThrow(
      "INVALID_TENANT_PROFILE_DRAFT",
    );
    expect(() =>
      readTenantProvisioningCommandResult({
        replayed: false,
        operation: {
          id: OPERATION_ID,
          type: "RECONCILE",
          status: "QUEUED",
        },
      }),
    ).toThrow("INVALID_TENANT_COMMAND_RESPONSE");
  });

  it("derives immutable platform-domain and legacy promotion rules", () => {
    const normal = tenantFixture();
    const custom = customFqdnFixture();
    expect(platformFqdnForTenant(normal)).toBe("acme.mutakamel.ai");
    expect(hasPlatformPrimaryFqdn(normal)).toBe(true);
    expect(canPromoteLegacyPrimary(normal, custom)).toBe(false);

    const legacy = tenantFixture("ACTIVE", { fqdns: [custom] });
    expect(hasPlatformPrimaryFqdn(legacy)).toBe(false);
    expect(canPromoteLegacyPrimary(legacy, custom)).toBe(true);
    expect(
      canPromoteLegacyPrimary(legacy, {
        ...custom,
        validationStatus: "PENDING",
        verifiedAt: null,
      }),
    ).toBe(false);
    expect(
      canPromoteLegacyPrimary(
        tenantFixture("SUSPENDED", { fqdns: [custom] }),
        custom,
      ),
    ).toBe(false);
  });

  it("allows attach only with authoritative available evidence", () => {
    expect(canAttachAfterPreflight(null)).toBe(false);
    expect(
      canAttachAfterPreflight({
        fqdn: "portal.example.com",
        valid: true,
        available: true,
        message: "ok",
      }),
    ).toBe(true);
    expect(
      canAttachAfterPreflight({
        fqdn: "portal.example.com",
        valid: false,
        available: true,
        reason: "DNS_NOT_FOUND",
        message: "pending",
      }),
    ).toBe(true);
    expect(
      canAttachAfterPreflight({
        fqdn: "portal.example.com",
        valid: false,
        available: false,
        reason: "TAKEN",
        message: "taken",
      }),
    ).toBe(false);
  });

  it("adds or replaces nested FQDN evidence without a collection GET", () => {
    const tenant = tenantFixture();
    const added = replaceTenantFqdn(tenant, customFqdnFixture());
    expect(added.fqdns.map((row) => row.id)).toEqual([
      PLATFORM_FQDN_ID,
      CUSTOM_FQDN_ID,
    ]);
    const replaced = replaceTenantFqdn(added, {
      ...customFqdnFixture(),
      updatedAt: NEXT_UPDATED_AT,
    });
    expect(replaced.fqdns).toHaveLength(2);
    expect(replaced.fqdns[1]?.updatedAt).toBe(NEXT_UPDATED_AT);
  });
});
