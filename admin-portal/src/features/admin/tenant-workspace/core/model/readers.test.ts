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
  tenantDestroyFixture,
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
  readTenantDestroy,
  readTenantDestroyRequest,
  readTenantFqdn,
  readTenantFqdnList,
  readTenantProvisioningCommandResult,
  readTenantView,
  replaceTenantFqdn,
} from "./readers";

describe("tenant destruction reader", () => {
  it("passes through Core's null when destruction was never requested", () => {
    expect(readTenantDestroy(null)).toBeNull();
  });

  it.each([
    ["STOPPING_PROVISIONING", { lastErrorCode: "TENANT_DESTROY_OPEN_PROVISIONING_OPERATION" }],
    ["DROPPING_DATABASE", { lastErrorCode: "WORKER.TENANT.DATABASE_TEARDOWN_FAILED" }],
    ["FINALIZING", {}],
    ["SUCCEEDED", {}],
    ["BLOCKED", { blockedReason: "WORKER.TENANT_DESTROY.CORE_UNREACHABLE", blockingOperationId: null }],
    // Halted after the drop was authorized: Core cleared the waited-on
    // provisioning operation when it authorized the drop.
    [
      "BLOCKED",
      {
        blockedPhase: "DROPPING_DATABASE",
        blockedReason: "WORKER.TENANT_DESTROY.AUTHORITY_CHANGED",
        lastErrorCode: "WORKER.TENANT_DESTROY.AUTHORITY_CHANGED",
        blockingOperationId: null,
        attempts: 20,
      },
    ],
    [
      "BLOCKED",
      {
        blockedPhase: "FINALIZING",
        blockedReason: "WORKER.TENANT_DESTROY.CORE_REJECTED",
        blockingOperationId: null,
        attempts: 20,
      },
    ],
    // Abandoned straight from stopping: no block evidence.
    ["ABANDONED", {}],
    // Abandoned after it blocked: the block evidence survives.
    [
      "ABANDONED",
      {
        blockedAt: UPDATED_AT,
        blockedReason: "TENANT_DESTROY_MULTIPLE_OPEN_OPERATIONS",
        blockedPhase: "STOPPING_PROVISIONING",
        blockingOperationId: OPERATION_ID,
        lastErrorCode: "TENANT_DESTROY_MULTIPLE_OPEN_OPERATIONS",
      },
    ],
  ] as const)("reads the %s projection exactly", (phase, overrides) => {
    const operation = tenantDestroyFixture(phase, overrides);
    expect(readTenantDestroy({ ...operation })).toEqual(operation);
  });

  it("drops fields Core does not document", () => {
    const parsed = readTenantDestroy({
      ...tenantDestroyFixture("BLOCKED"),
      databaseName: "tenant_acme",
      abandonedBy: OPERATION_ID,
    });
    expect(parsed).not.toHaveProperty("databaseName");
    expect(parsed).not.toHaveProperty("abandonedBy");
  });

  it.each([
    ["an unknown phase", { phase: "PAUSED" }],
    ["a missing attempt count", { attempts: undefined }],
    ["a negative attempt count", { attempts: -1 }],
    ["a fractional attempt count", { attempts: 1.5 }],
    ["an absent nullable field", { abandonedAt: undefined }],
    ["a malformed timestamp", { requestedAt: "yesterday" }],
    ["a non-v7 request id", { operationId: "00000000-0000-4000-8000-000000000000" }],
    ["a non-v7 provisioning operation", { blockingOperationId: "not-an-id" }],
    ["a code that is not a safe code", { blockedReason: "pg: relation does not exist" }],
    ["an over-long code", { blockedReason: `WORKER.${"A".repeat(100)}` }],
    ["a BLOCKED request without its reason", { blockedReason: null, blockedAt: null }],
    ["a block time without a reason", { blockedReason: null }],
    ["a scheduled attempt after automation ended", { nextAttemptAt: NEXT_UPDATED_AT }],
    ["a completion on a blocked request", { completedAt: NEXT_UPDATED_AT }],
    ["an abandonment time on a blocked request", { abandonedAt: NEXT_UPDATED_AT }],
    ["an absent blocked phase", { blockedPhase: undefined }],
    ["a blocked phase Core cannot stop in", { blockedPhase: "SUCCEEDED" }],
    ["a BLOCKED request without the phase it stopped in", { blockedPhase: null }],
    [
      "a halted request still naming a provisioning operation",
      { blockedPhase: "DROPPING_DATABASE", blockingOperationId: OPERATION_ID },
    ],
  ] as const)("rejects %s", (_label, overrides) => {
    expect(() =>
      readTenantDestroy({ ...tenantDestroyFixture("BLOCKED"), ...overrides }),
    ).toThrow("INVALID_TENANT_DESTROY_RESPONSE");
  });

  it.each([
    ["an advancing request without its next attempt", "DROPPING_DATABASE", { nextAttemptAt: null }],
    ["block evidence while advancing", "STOPPING_PROVISIONING", { blockedAt: UPDATED_AT, blockedReason: "TENANT_DESTROY_OPEN_PROVISIONING_OPERATION", blockedPhase: "STOPPING_PROVISIONING" }],
    ["a blocked phase without block evidence", "DROPPING_DATABASE", { blockedPhase: "DROPPING_DATABASE" }],
    ["a waited-on operation after the drop was authorized", "DROPPING_DATABASE", { blockingOperationId: OPERATION_ID }],
    ["a success without its completion time", "SUCCEEDED", { completedAt: null }],
    ["an abandoned request without its abandonment time", "ABANDONED", { abandonedAt: null }],
    [
      "an abandoned request that halted after the drop was authorized",
      "ABANDONED",
      { blockedAt: UPDATED_AT, blockedReason: "WORKER.TENANT_DESTROY.AUTHORITY_CHANGED", blockedPhase: "FINALIZING" },
    ],
  ] as const)("rejects %s", (_label, phase, overrides) => {
    expect(() =>
      readTenantDestroy({ ...tenantDestroyFixture(phase), ...overrides }),
    ).toThrow("INVALID_TENANT_DESTROY_RESPONSE");
  });

  it.each([
    ["a new or returned request", "BLOCKED", false],
    ["a stop sent back to stopping provisioning", "STOPPING_PROVISIONING", true],
    ["a halted drop that continues", "DROPPING_DATABASE", true],
  ] as const)("reads a destroy answer for %s with its resumed flag", (_label, phase, resumed) => {
    const operation = tenantDestroyFixture(phase);
    expect(readTenantDestroyRequest({ ...operation, resumed })).toEqual({
      ...operation,
      resumed,
    });
  });

  it.each([
    ["no resumed flag", undefined, "STOPPING_PROVISIONING"],
    ["a resumed flag that is not a boolean", "true", "STOPPING_PROVISIONING"],
    ["a resume that left the request BLOCKED", true, "BLOCKED"],
    ["a resume of a request that already finished", true, "SUCCEEDED"],
  ] as const)("rejects a destroy answer with %s", (_label, resumed, phase) => {
    expect(() =>
      readTenantDestroyRequest({ ...tenantDestroyFixture(phase), resumed }),
    ).toThrow("INVALID_TENANT_DESTROY_RESPONSE");
    expect(() => readTenantDestroyRequest(null)).toThrow(
      "INVALID_TENANT_DESTROY_RESPONSE",
    );
  });
});

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
