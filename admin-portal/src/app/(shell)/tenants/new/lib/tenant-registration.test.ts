import { describe, expect, it } from "vitest";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  buildTenantSubscriptionLines,
  getCanonicalCountrySelection,
  getTenantRegistrationLoadState,
  isCanonicalCountrySelection,
  isTenantIdentityEvidenceCurrent,
  readDatabasePlacementOptions,
  readProvisioningPlanPreview,
  readSubscriptionQuote,
  readTenantCreateOptions,
  readTenantCreateResult,
  readTenantIdentityValidation,
  shouldRetainTenantCreateIntent,
  tenantIdentityFingerprint,
} from "./tenant-registration";
import type { TenantApplicationCandidate } from "../types";

const applicationId = "019f0000-0000-7000-8000-000000000001";
const tierId = "019f0000-0000-7000-8000-000000000002";
const databaseId = "019f0000-0000-7000-8000-000000000003";
const quoteId = "019f0000-0000-7000-8000-000000000004";
const tenantId = "019f0000-0000-7000-8000-000000000005";

const candidate: TenantApplicationCandidate = {
  applicationId,
  key: "crm",
  name: "CRM",
  description: null,
  rank: 10,
  commercialMode: "SUBSCRIPTION",
  technicalDefinitionRevision: "7",
  selectionAllowed: true,
  selectionBlockers: [],
  readinessReasons: [],
  catalogueReasons: [],
  tiers: [{ id: tierId, key: "business", name: "Business", rank: 1 }],
};

describe("tenant registration contract", () => {
  it("derives country name, calling code, and timezone from the canonical ISO registry", () => {
    expect(getCanonicalCountrySelection(" eg ")).toEqual({
      countryName: "Egypt",
      countryIsoCode: "EG",
      callingCode: "+20",
      timezones: ["Africa/Cairo"],
    });
    expect(
      isCanonicalCountrySelection({
        countryName: "Egypt",
        countryIsoCode: "EG",
        timezone: "Africa/Cairo",
      }),
    ).toBe(true);
    expect(
      isCanonicalCountrySelection({
        countryName: "A mismatched client label",
        countryIsoCode: "EG",
        timezone: "Africa/Cairo",
      }),
    ).toBe(false);
    expect(getCanonicalCountrySelection("ZZ")).toBeNull();
  });

  it("accepts only the bounded least-privilege create-options projection", () => {
    const payload = {
      contractVersion: 1,
      applications: [
        {
          applicationId,
          key: "crm",
          name: "CRM",
          description: null,
          rank: 10,
          commercialMode: "SUBSCRIPTION",
          technicalDefinitionRevision: "7",
          selectionAllowed: true,
          selectionBlockers: [],
          readinessReasons: [],
          catalogueReasons: [],
          tiers: [{ id: tierId, key: "business", name: "Business", rank: 1 }],
        },
      ],
    };

    expect(readTenantCreateOptions(payload)).toEqual([candidate]);
    expect(() =>
      readTenantCreateOptions({
        ...payload,
        applications: [
          { ...payload.applications[0], credentialsRef: "must-not-cross" },
        ],
      }),
    ).toThrow("INVALID_TENANT_CREATE_OPTIONS_RESPONSE");
    expect(() =>
      readTenantCreateOptions({
        ...payload,
        applications: [
          {
            ...payload.applications[0],
            selectionAllowed: false,
            tiers: [],
            catalogueReasons: [],
          },
        ],
      }),
    ).toThrow("INVALID_TENANT_CREATE_OPTIONS_RESPONSE");
  });

  it("builds quote IDs and create keys from the same authoritative selection", () => {
    expect(
      buildTenantSubscriptionLines([candidate], {
        crm: { tierId, seats: 25 },
      }),
    ).toEqual([
      {
        applicationId,
        applicationKey: "crm",
        applicationName: "CRM",
        tierId,
        tierKey: "business",
        tierName: "Business",
        seats: 25,
      },
    ]);

    expect(
      buildTenantSubscriptionLines(
        [{ ...candidate, selectionAllowed: false }],
        { crm: { tierId, seats: 25 } },
      ),
    ).toEqual([]);
    expect(
      buildTenantSubscriptionLines([candidate], {
        crm: { tierId: databaseId, seats: 25 },
      }),
    ).toEqual([]);
  });

  it("keeps loading, permission, error, and empty catalogue states fail closed", () => {
    expect(
      getTenantRegistrationLoadState({
        permitted: false,
        isLoading: true,
        hasError: false,
        itemCount: 0,
      }),
    ).toBe("loading");
    expect(
      getTenantRegistrationLoadState({
        permitted: false,
        isLoading: false,
        hasError: false,
        itemCount: 2,
      }),
    ).toBe("forbidden");
    expect(
      getTenantRegistrationLoadState({
        permitted: true,
        isLoading: false,
        hasError: true,
        itemCount: 2,
      }),
    ).toBe("error");
    expect(
      getTenantRegistrationLoadState({
        permitted: true,
        isLoading: false,
        hasError: false,
        itemCount: 0,
        idle: true,
      }),
    ).toBe("idle");
  });

  it("accepts only bounded, active, capacity-safe UUIDv7 database options", () => {
    expect(
      readDatabasePlacementOptions({
        items: [
          {
            id: databaseId,
            name: "PostgreSQL Cairo 01",
            status: "ACTIVE",
            countryName: "Egypt",
            countryIsoCode: "EG",
            currentTenants: 12,
            maxTenants: 50,
            password: "must-not-cross-the-boundary",
          },
        ],
        total: 1,
      }),
    ).toEqual([
      {
        id: databaseId,
        name: "PostgreSQL Cairo 01",
        status: "ACTIVE",
        countryName: "Egypt",
        countryIsoCode: "EG",
        currentTenants: 12,
        maxTenants: 50,
      },
    ]);

    expect(() =>
      readDatabasePlacementOptions({
        items: [
          {
            id: "srv-eg-01",
            name: "Fake",
            status: "ACTIVE",
            currentTenants: 0,
            maxTenants: 1,
          },
        ],
        total: 1,
      }),
    ).toThrow("INVALID_DATABASE_PLACEMENT_OPTIONS_RESPONSE");
    expect(() => readDatabasePlacementOptions({ items: [], total: 1 })).toThrow(
      "INVALID_DATABASE_PLACEMENT_OPTIONS_RESPONSE",
    );
  });

  it("normalizes nullable database location metadata from Core", () => {
    const parsed = readDatabasePlacementOptions({
      items: [
        {
          id: databaseId,
          name: "PostgreSQL Global 01",
          status: "ACTIVE",
          countryName: null,
          countryIsoCode: null,
          currentTenants: 0,
          maxTenants: 50,
        },
      ],
      total: 1,
    });

    expect(parsed).toEqual([
      {
        id: databaseId,
        name: "PostgreSQL Global 01",
        status: "ACTIVE",
        currentTenants: 0,
        maxTenants: 50,
      },
    ]);
    expect(parsed[0]).not.toHaveProperty("countryName");
    expect(parsed[0]).not.toHaveProperty("countryIsoCode");

    expect(() =>
      readDatabasePlacementOptions({
        items: [
          {
            ...parsed[0],
            countryName: "   ",
          },
        ],
        total: 1,
      }),
    ).toThrow("INVALID_DATABASE_PLACEMENT_OPTIONS_RESPONSE");
    expect(() =>
      readDatabasePlacementOptions({
        items: [
          {
            ...parsed[0],
            countryIsoCode: "egy",
          },
        ],
        total: 1,
      }),
    ).toThrow("INVALID_DATABASE_PLACEMENT_OPTIONS_RESPONSE");
  });

  it("binds the preview and quote to the exact selected Applications", () => {
    const preview = {
      contractVersion: 1,
      selectedApplicationKeys: ["crm"],
      selectionDigest: "a".repeat(64),
      components: [],
      steps: [],
    };
    expect(readProvisioningPlanPreview(preview, ["crm"])).toEqual(preview);
    expect(() => readProvisioningPlanPreview(preview, ["trade"])).toThrow(
      "INVALID_TENANT_PROVISIONING_PREVIEW_RESPONSE",
    );

    const lines = buildTenantSubscriptionLines([candidate], {
      crm: { tierId, seats: 25 },
    });
    const quote = {
      quoteId,
      requestHash: "request-hash",
      pricingRevision: "12",
      billingCycle: "ANNUAL",
      currencyCode: "USD",
      total: "120.00",
      totalUsd: "120.00",
      items: [
        {
          moduleId: applicationId,
          tierId,
          seats: 25,
          lineTotal: "120.00",
          lineTotalUsd: "120.00",
        },
      ],
      expiresAt: "2030-01-01T00:00:00.000Z",
    };
    expect(readSubscriptionQuote(quote, lines, "ANNUAL")).toEqual(quote);
    expect(() =>
      readSubscriptionQuote(
        { ...quote, items: [{ ...quote.items[0], seats: 26 }] },
        lines,
        "ANNUAL",
      ),
    ).toThrow("INVALID_SUBSCRIPTION_QUOTE_RESPONSE");
  });

  it("accepts only a fresh PROVISIONING tenant result", () => {
    expect(
      readTenantCreateResult({ id: tenantId, status: "PROVISIONING" }),
    ).toEqual({ id: tenantId, status: "PROVISIONING" });
    expect(() =>
      readTenantCreateResult({ id: tenantId, status: "ACTIVE" }),
    ).toThrow("INVALID_TENANT_CREATE_RESPONSE");
  });

  it("parses identity evidence and binds it to normalized input", () => {
    const available = {
      valid: true,
      fields: {
        name: { valid: true, available: true, message: "Name is available." },
        companyName: {
          valid: true,
          available: true,
          message: "Company name is available.",
        },
      },
      message: "Identity is available.",
    };
    expect(readTenantIdentityValidation(available)).toEqual(available);
    expect(tenantIdentityFingerprint("  ACME  ", " Acme LLC ")).toBe(
      tenantIdentityFingerprint("acme", "Acme LLC"),
    );
    const evidence = {
      fingerprint: tenantIdentityFingerprint("acme", "Acme LLC"),
      result: available,
    };
    expect(isTenantIdentityEvidenceCurrent(evidence, "ACME", "Acme LLC")).toBe(
      true,
    );
    expect(isTenantIdentityEvidenceCurrent(evidence, "trade", "Acme LLC")).toBe(
      false,
    );
    expect(isTenantIdentityEvidenceCurrent(evidence, "acme", "Other LLC")).toBe(
      false,
    );

    const taken = {
      ...available,
      valid: false,
      fields: {
        ...available.fields,
        name: {
          valid: true,
          available: false,
          reason: "TAKEN",
          message: "Name is already used.",
        },
      },
      message: "Identity is unavailable.",
    };
    expect(readTenantIdentityValidation(taken)).toEqual(taken);
    expect(() =>
      readTenantIdentityValidation({ ...available, valid: false }),
    ).toThrow("INVALID_TENANT_IDENTITY_VALIDATION_RESPONSE");
    expect(() =>
      readTenantIdentityValidation({ ...available, secret: "unexpected" }),
    ).toThrow("INVALID_TENANT_IDENTITY_VALIDATION_RESPONSE");
  });

  it("retains a create intent only for ambiguous and in-flight failures", () => {
    const error = (
      httpStatus: number,
      errorCode: string,
    ): NormalizedApiError => ({
      isNormalized: true,
      httpStatus,
      errorCode,
      message: "failure",
    });
    expect(shouldRetainTenantCreateIntent(error(503, "HTTP_503"))).toBe(true);
    expect(
      shouldRetainTenantCreateIntent(error(409, "GW.IDEM.IN_FLIGHT")),
    ).toBe(true);
    expect(shouldRetainTenantCreateIntent(error(500, "UNKNOWN_ERROR"))).toBe(
      true,
    );
    expect(
      shouldRetainTenantCreateIntent(error(409, "IDEMPOTENCY_KEY_REUSED")),
    ).toBe(false);
    expect(
      shouldRetainTenantCreateIntent(error(400, "VALIDATION_FAILED")),
    ).toBe(false);
  });
});
