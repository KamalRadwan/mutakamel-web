import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

vi.mock("@/shared/api/core-envelope", () => ({
  extractCoreData: (response: { data: { data: unknown } }) =>
    response.data.data,
}));

import { tenantRegistrationApi } from "./tenant-registration.api";
import type { TenantCreateCommand, TenantSubscriptionLine } from "../types";

const applicationId = "019f0000-0000-7000-8000-000000000001";
const tierId = "019f0000-0000-7000-8000-000000000002";
const databaseId = "019f0000-0000-7000-8000-000000000003";
const storageId = "019f0000-0000-7000-8000-000000000004";
const quoteId = "019f0000-0000-7000-8000-000000000005";
const tenantId = "019f0000-0000-7000-8000-000000000006";
const idempotencyKey = "019f0000-0000-7000-8000-000000000007";
const envelope = (data: unknown) => ({ data: { data } });

const lines: TenantSubscriptionLine[] = [
  {
    applicationId,
    applicationKey: "crm",
    applicationName: "CRM",
    tierId,
    tierKey: "business",
    tierName: "Business",
    seats: 10,
  },
];

describe("tenant registration API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("validates identity through the idempotent read-like command", async () => {
    const controller = new AbortController();
    const result = {
      valid: true,
      fields: {
        name: { valid: true, available: true, message: "Available" },
        companyName: { valid: true, available: true, message: "Available" },
      },
      message: "Identity is available.",
    };
    postMock.mockResolvedValue(envelope(result));

    await expect(
      tenantRegistrationApi.validateIdentity(
        { name: "acme", companyName: "Acme LLC" },
        controller.signal,
      ),
    ).resolves.toEqual(result);
    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants/validate-identity",
      { name: "acme", companyName: "Acme LLC" },
      {
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        signal: controller.signal,
      },
    );
  });

  it("reverse-geocodes exact coordinates without an idempotency header", async () => {
    const controller = new AbortController();
    const suggestion = {
      countryName: "Egypt",
      countryIsoCode: "EG",
      state: "Cairo",
      city: "Cairo",
      street1: "Tahrir Street",
      buildingNo: "10",
      formattedAddress: "10 Tahrir Street, Cairo, Egypt",
    };
    postMock.mockResolvedValue(envelope(suggestion));

    await expect(
      tenantRegistrationApi.reverseGeocode(
        { latitude: 30.0444, longitude: 31.2357 },
        controller.signal,
      ),
    ).resolves.toEqual(suggestion);
    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants/reverse-geocode",
      { latitude: 30.0444, longitude: 31.2357 },
      {
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        signal: controller.signal,
      },
    );
  });

  it("loads one least-privilege create-options snapshot", async () => {
    const candidate = {
      applicationId,
      key: "crm",
      name: "CRM",
      description: null,
      rank: 2,
      commercialMode: "SUBSCRIPTION",
      technicalDefinitionRevision: "3",
      selectionAllowed: true,
      selectionBlockers: [],
      readinessReasons: [],
      catalogueReasons: [],
      tiers: [{ id: tierId, key: "business", name: "Business", rank: 1 }],
    };
    getMock.mockResolvedValue(
      envelope({ contractVersion: 1, applications: [candidate] }),
    );

    await expect(
      tenantRegistrationApi.listCandidateApplications(),
    ).resolves.toEqual([candidate]);
    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants/create-options",
      { signal: undefined },
    );
  });

  it("uses exact selected Application keys for placement and preview", async () => {
    getMock.mockResolvedValue(
      envelope({
        items: [
          {
            id: databaseId,
            name: "DB 01",
            status: "ACTIVE",
            countryName: null,
            countryIsoCode: null,
            currentTenants: 1,
            maxTenants: 50,
          },
        ],
        total: 1,
      }),
    );
    postMock.mockResolvedValue(
      envelope({
        contractVersion: 1,
        selectedApplicationKeys: ["crm", "trade"],
        selectionDigest: "a".repeat(64),
        components: [],
        steps: [],
      }),
    );

    await expect(
      tenantRegistrationApi.listDatabasePlacementOptions([
        "trade",
        "crm",
        "crm",
      ]),
    ).resolves.toEqual([
      {
        id: databaseId,
        name: "DB 01",
        status: "ACTIVE",
        currentTenants: 1,
        maxTenants: 50,
      },
    ]);
    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants/database-placement-options?applicationKeys=crm%2Ctrade",
    );

    await tenantRegistrationApi.previewProvisioningPlan(["trade", "crm"]);
    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants/provisioning-plans",
      { moduleKeys: ["crm", "trade"] },
      { skipAutoIdempotency: true, replayAfterRefresh: true },
    );
  });

  it("quotes with UUID IDs and creates with the matching nested V1 keys", async () => {
    postMock
      .mockResolvedValueOnce(
        envelope({
          quoteId,
          requestHash: "hash",
          pricingRevision: "1",
          billingCycle: "ANNUAL",
          currencyCode: "USD",
          total: "50.00",
          totalUsd: "50.00",
          items: [
            {
              moduleId: applicationId,
              tierId,
              seats: 10,
              lineTotal: "50.00",
              lineTotalUsd: "50.00",
            },
          ],
          expiresAt: "2030-01-01T00:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        envelope({ id: tenantId, status: "PROVISIONING" }),
      );

    await tenantRegistrationApi.quote(lines, "ANNUAL");
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/core/v1/subscriptions/quote",
      {
        billingCycle: "ANNUAL",
        currencyCode: "USD",
        items: [{ moduleId: applicationId, tierId, seats: 10 }],
      },
      { skipAutoIdempotency: true, replayAfterRefresh: true },
    );

    const command: TenantCreateCommand = {
      quoteId,
      name: "acme",
      companyName: "Acme",
      countryName: "Egypt",
      countryIsoCode: "EG",
      industry: "Retail",
      timezone: "Africa/Cairo",
      phoneCountryCode: "+20",
      address: {},
      databaseServerId: databaseId,
      storageServerId: storageId,
      ownerEmail: "owner@example.com",
      ownerFirstName: "Ada",
      ownerLastName: "Lovelace",
      ownerPhoneCountryCode: "+20",
      ownerPhone: "1000000000",
      ownerJobTitle: "Owner",
      sendInvitation: true,
      ownerActive: true,
      subscription: {
        billingCycle: "ANNUAL",
        currencyCode: "USD",
        trialDays: 14,
        items: [{ moduleKey: "crm", tierKey: "business", seats: 10 }],
      },
    };
    await expect(
      tenantRegistrationApi.create(command, idempotencyKey),
    ).resolves.toEqual({ id: tenantId, status: "PROVISIONING" });
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/core/v1/tenants",
      command,
      { headers: { "x-idempotency-key": idempotencyKey } },
    );
    expect(command).not.toHaveProperty("modules");
    expect(command).not.toHaveProperty("billingCycle");
    expect(command).not.toHaveProperty("allowedUsers");
  });

  it("recovers create status through an exact-name, read-only tenant lookup", async () => {
    const controller = new AbortController();
    getMock.mockResolvedValue(
      envelope([
        {
          id: tenantId,
          name: "acme",
          status: "PROVISIONING",
          ownerEmail: "must-not-escape@example.com",
        },
      ]),
    );

    await expect(
      tenantRegistrationApi.findCreateStatus("acme", controller.signal),
    ).resolves.toEqual({ id: tenantId, name: "acme", status: "PROVISIONING" });
    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants?page=1&limit=20&search=acme&sortBy=createdAt&sortDir=DESC",
      { signal: controller.signal },
    );
  });
});
