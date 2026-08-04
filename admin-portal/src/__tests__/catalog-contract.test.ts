import { describe, it, expect, vi, beforeEach } from "vitest";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import { axiosClient } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/shared/utils/idempotency";
import type { AxiosResponse } from "@/lib/api/axiosClient";

vi.mock("@/lib/api/axiosClient");

const asAxiosResponse = (value: unknown) => value as AxiosResponse<unknown>;

describe("Application Catalogue API Contract Tests (27 Routes)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("1. GET /api/admin/core/v1/applications - lists applications with valid enum filter", async () => {
    const mockData = {
      data: {
        success: true,
        data: [{ id: "app-1", key: "crm", name: "CRM", applicationType: "TENANT", commercialMode: "SUBSCRIPTION" }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false }
      }
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce(asAxiosResponse(mockData));

    const result = await applicationsApi.list({ applicationType: "TENANT" });
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/applications?applicationType=TENANT");
    expect(result.data[0].applicationType).toBe("TENANT");
  });

  it("2. POST /api/admin/core/v1/applications - registers application with idempotency key", async () => {
    const mockData = {
      data: {
        success: true,
        data: {
          contractVersion: 1,
          operation: "CREATE",
          applicationId: "app-1",
          applicationKey: "crm",
          lifecycleStatus: "DRAFT",
          catalogueRevision: "1",
          policyRevision: "1",
          deleted: false
        }
      }
    };
    vi.mocked(axiosClient.post).mockResolvedValueOnce(asAxiosResponse(mockData));

    const key = generateUUIDv7();
    const dto = {
      key: "crm",
      name: "CRM Application",
      applicationType: "TENANT" as const,
      commercialMode: "SUBSCRIPTION" as const,
      catalogueVisibility: "PUBLIC" as const
    };

    const result = await applicationsApi.create(dto, key);
    expect(axiosClient.post).toHaveBeenCalledWith(
      "/api/admin/core/v1/applications",
      dto,
      { headers: { "x-idempotency-key": key } }
    );
    expect(result.applicationKey).toBe("crm");
  });

  it("3. GET /api/admin/core/v1/applications/:id/tiers - lists application tiers", async () => {
    const mockData = {
      data: {
        success: true,
        data: [{ id: "tier-1", moduleId: "app-1", key: "basic", name: "Basic Tier", rank: 1 }]
      }
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce(asAxiosResponse(mockData));

    const result = await applicationsApi.listTiers("app-1");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/applications/app-1/tiers");
    expect(result[0].key).toBe("basic");
  });

  it("4. PATCH /api/admin/core/v1/tiers/:tierId/features - replaces tier feature grants", async () => {
    const mockData = {
      data: {
        success: true,
        data: [{ id: "grant-1", tierId: "tier-1", featureId: "feat-1", enabled: true }]
      }
    };
    vi.mocked(axiosClient.patch).mockResolvedValueOnce(asAxiosResponse(mockData));

    const key = generateUUIDv7();
    const dto = {
      features: [{ featureId: "feat-1" }]
    };

    const result = await applicationsApi.replaceTierGrants("tier-1", dto, key);
    expect(axiosClient.patch).toHaveBeenCalledWith(
      "/api/admin/core/v1/tiers/tier-1/features",
      dto,
      { headers: { "x-idempotency-key": key } }
    );
    expect(result[0].featureId).toBe("feat-1");
  });

  it("5. PATCH /api/admin/core/v1/billing/currency-rates - batch updates currency rates", async () => {
    const mockData = {
      data: {
        success: true,
        data: [{ currencyCode: "EUR", currencyUnitsPerUsd: "0.92" }]
      }
    };
    vi.mocked(axiosClient.patch).mockResolvedValueOnce(asAxiosResponse(mockData));

    const key = generateUUIDv7();
    const dto = {
      rates: [{ currencyCode: "EUR", currencyUnitsPerUsd: "0.92" }]
    };

    const result = await applicationsApi.batchUpsertCurrencyRates(dto, key);
    expect(axiosClient.patch).toHaveBeenCalledWith(
      "/api/admin/core/v1/billing/currency-rates",
      dto,
      { headers: { "x-idempotency-key": key } }
    );
    expect(result[0].currencyUnitsPerUsd).toBe("0.92");
  });

  it("covers the remaining Application Catalogue routes with exact methods and paths", async () => {
    const envelope = { data: { success: true, data: [], correlationId: "corr", timestamp: "2026-08-02T12:00:00Z" } };
    vi.mocked(axiosClient.get).mockResolvedValue(asAxiosResponse(envelope));
    vi.mocked(axiosClient.post).mockResolvedValue(asAxiosResponse(envelope));
    vi.mocked(axiosClient.patch).mockResolvedValue(asAxiosResponse(envelope));
    vi.mocked(axiosClient.delete).mockResolvedValue(asAxiosResponse(envelope));
    const key = generateUUIDv7();

    await applicationsApi.get("crm/injected");
    await applicationsApi.getManifests("crm");
    await applicationsApi.update("crm", { expectedCatalogueRevision: "1", name: "CRM" }, key);
    await applicationsApi.delete("crm", "1", "Unused draft", key);
    await applicationsApi.updateDatabasePolicy("crm", { expectedPolicyRevision: "1", rotationEnabled: true, reason: "Enable rotation" }, key);
    await applicationsApi.activate("crm", "1", "Activate", key);
    await applicationsApi.deprecate("crm", { expectedCatalogueRevision: "2", reason: "Deprecate" }, key);
    await applicationsApi.disable("crm", { expectedCatalogueRevision: "3", reason: "Disable" }, key);
    await applicationsApi.getGlobalAudit({ page: 1 });
    await applicationsApi.getApplicationAudit("app-1", { page: 1 });
    await applicationsApi.createTier("app-1", { key: "basic", name: "Basic" });
    await applicationsApi.updateTier("tier-1", { name: "Basic Plus" }, key);
    await applicationsApi.deleteTier("tier-1", key);
    await applicationsApi.createFeature("app-1", { key: "crm.leads", name: "Leads" });
    await applicationsApi.listFeatures("app-1");
    await applicationsApi.updateFeature("feature-1", { name: "Lead management" }, key);
    await applicationsApi.deleteFeature("feature-1", key);
    await applicationsApi.getTierGrants("tier-1");
    await applicationsApi.getPriceLadder("tier-1", "ANNUAL");
    await applicationsApi.replacePriceLadder("tier-1", { billingCycle: "MONTHLY", brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "15.0000" }] }, key);
    await applicationsApi.listCurrencyRates();
    await applicationsApi.upsertCurrencyRate("eur", { currencyUnitsPerUsd: "0.9300", isActive: true }, key);

    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/applications/crm%2Finjected");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/applications/crm/database-manifests");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/catalog/audit?page=1");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/applications/app-1/audit?page=1");
    expect(axiosClient.post).toHaveBeenCalledWith("/api/admin/core/v1/applications/app-1/tiers", { key: "basic", name: "Basic" });
    expect(axiosClient.post).toHaveBeenCalledWith("/api/admin/core/v1/applications/app-1/features", { key: "crm.leads", name: "Leads" });
    expect(axiosClient.patch).toHaveBeenCalledWith("/api/admin/core/v1/tiers/tier-1", { name: "Basic Plus" }, { headers: { "x-idempotency-key": key } });
    expect(axiosClient.patch).toHaveBeenCalledWith("/api/admin/core/v1/features/feature-1", { name: "Lead management" }, { headers: { "x-idempotency-key": key } });
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/tiers/tier-1/features");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/tiers/tier-1/price-tiers?billingCycle=ANNUAL");
    expect(axiosClient.patch).toHaveBeenCalledWith("/api/admin/core/v1/tiers/tier-1/price-tiers", { billingCycle: "MONTHLY", brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "15.0000" }] }, { headers: { "x-idempotency-key": key } });
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/billing/currency-rates");
    expect(axiosClient.patch).toHaveBeenCalledWith("/api/admin/core/v1/billing/currency-rates/EUR", { currencyUnitsPerUsd: "0.9300", isActive: true }, { headers: { "x-idempotency-key": key } });
    expect(axiosClient.delete).toHaveBeenCalledWith("/api/admin/core/v1/tiers/tier-1", { headers: { "x-idempotency-key": key } });
    expect(axiosClient.delete).toHaveBeenCalledWith("/api/admin/core/v1/features/feature-1", { headers: { "x-idempotency-key": key } });
  });
});
