import { axiosClient } from "@/lib/api/axiosClient";
import { SuccessResponse, extractCoreData, extractCoreMeta } from "@/shared/api/core-envelope";
import {
  ApplicationListQueryDto,
  ApplicationView,
  CreateApplicationDto,
  OnboardApplicationDto,
  ApplicationMutationReceipt,
  UpdateApplicationDto,
  UpdateApplicationDatabasePolicyDto,
  ApplicationLifecycleCommandDto,
  PublishApplicationDto,
  ApplicationManifestEvidenceView,
  ApplicationDatabaseServerCandidatesView,
  ApplicationDatabaseServerBindReceipt,
  BindApplicationDatabaseServersDto,
  ApplicationTechnicalReadinessView,
  CreateApplicationProvisioningBindingDto,
  AdoptApplicationTechnicalPackageDto,
  TierView,
  CreateTierDto,
  UpdateTierDto,
  FeatureView,
  CreateFeatureDto,
  UpdateFeatureDto,
  TierFeatureGrantView,
  SetTierFeaturesDto,
  PriceTierView,
  SetPriceTiersDto,
  CurrencyRateView,
  UpsertCurrencyRateDto,
  SetCurrencyRatesDto,
  CatalogueAuditPageView,
  CatalogueAuditQueryDto,
  BillingCycle,
} from "../types";

const BASE_URL = "/api/admin/core/v1/applications";
const TIER_BASE_URL = "/api/admin/core/v1/tiers";
const FEATURE_BASE_URL = "/api/admin/core/v1/features";
const AUDIT_BASE_URL = "/api/admin/core/v1/catalog/audit";
const CURRENCY_BASE_URL = "/api/admin/core/v1/billing/currency-rates";

function toQueryString(query?: object): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function getWithSignal<T>(url: string, signal?: AbortSignal) {
  return signal
    ? axiosClient.get<T>(url, { signal })
    : axiosClient.get<T>(url);
}

export const applicationsApi = {
  // --- Application Identity, Publication & Lifecycle Routes ---
  list: async (query?: ApplicationListQueryDto) => {
    const qs = toQueryString(query);
    const response = await axiosClient.get<SuccessResponse<ApplicationView[]>>(`${BASE_URL}${qs}`);
    return {
      data: extractCoreData(response),
      meta: extractCoreMeta(response)
    };
  },

  get: async (applicationKey: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<ApplicationView>>(`${BASE_URL}/${encodeURIComponent(applicationKey)}`, signal);
    return extractCoreData(response);
  },

  getManifests: async (applicationKey: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<ApplicationManifestEvidenceView[]>>(`${BASE_URL}/${encodeURIComponent(applicationKey)}/database-manifests`, signal);
    return extractCoreData(response);
  },

  getTechnicalProvisioning: async (applicationKey: string) => {
    const response = await axiosClient.get<SuccessResponse<ApplicationTechnicalReadinessView>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/technical-provisioning`
    );
    return extractCoreData(response);
  },

  createPrimaryProvisioningComponent: async (
    applicationKey: string,
    data: CreateApplicationProvisioningBindingDto,
    idempotencyKey: string
  ) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/technical-provisioning/primary-component`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  create: async (data: CreateApplicationDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      BASE_URL,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  update: async (applicationKey: string, data: UpdateApplicationDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  updateDatabasePolicy: async (applicationKey: string, data: UpdateApplicationDatabasePolicyDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/database-policy`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  onboard: async (data: OnboardApplicationDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/onboarding`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  adoptTechnicalPackage: async (
    applicationKey: string,
    data: AdoptApplicationTechnicalPackageDto,
    idempotencyKey: string
  ) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/technical-provisioning/adopt`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  publish: async (applicationKey: string, data: PublishApplicationDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/publish`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  activate: async (applicationKey: string, expectedCatalogueRevision: string, reason: string, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/activate`,
      { expectedCatalogueRevision, reason },
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  listBindableDatabaseServers: async (applicationKey: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<ApplicationDatabaseServerCandidatesView>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/database-servers`,
      signal,
    );
    return extractCoreData(response);
  },

  bindDatabaseServers: async (
    applicationKey: string,
    data: BindApplicationDatabaseServersDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationDatabaseServerBindReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/database-servers/bind`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  deprecate: async (applicationKey: string, data: ApplicationLifecycleCommandDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/deprecate`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  disable: async (applicationKey: string, data: ApplicationLifecycleCommandDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationMutationReceipt>>(
      `${BASE_URL}/${encodeURIComponent(applicationKey)}/disable`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  delete: async (applicationKey: string, expectedCatalogueRevision: string, reason: string, idempotencyKey: string) => {
    const qs = `?expectedCatalogueRevision=${encodeURIComponent(expectedCatalogueRevision)}&reason=${encodeURIComponent(reason)}`;
    await axiosClient.delete(`${BASE_URL}/${encodeURIComponent(applicationKey)}${qs}`, {
      headers: { "x-idempotency-key": idempotencyKey }
    });
  },

  // --- 4 Tier Routes ---
  listTiers: async (applicationId: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<TierView[]>>(`${BASE_URL}/${encodeURIComponent(applicationId)}/tiers`, signal);
    return extractCoreData(response);
  },

  createTier: async (applicationId: string, data: CreateTierDto) => {
    const response = await axiosClient.post<SuccessResponse<TierView>>(
      `${BASE_URL}/${encodeURIComponent(applicationId)}/tiers`,
      data,
      { skipAutoIdempotency: true, nonReplayable: true },
    );
    return extractCoreData(response);
  },

  updateTier: async (tierId: string, data: UpdateTierDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<TierView>>(
      `${TIER_BASE_URL}/${encodeURIComponent(tierId)}`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  deleteTier: async (tierId: string, idempotencyKey: string) => {
    await axiosClient.delete(`${TIER_BASE_URL}/${encodeURIComponent(tierId)}`, {
      headers: { "x-idempotency-key": idempotencyKey }
    });
  },

  // --- 4 Feature Routes ---
  listFeatures: async (applicationId: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<FeatureView[]>>(`${BASE_URL}/${encodeURIComponent(applicationId)}/features`, signal);
    return extractCoreData(response);
  },

  createFeature: async (applicationId: string, data: CreateFeatureDto) => {
    const response = await axiosClient.post<SuccessResponse<FeatureView>>(
      `${BASE_URL}/${encodeURIComponent(applicationId)}/features`,
      data,
      { skipAutoIdempotency: true, nonReplayable: true },
    );
    return extractCoreData(response);
  },

  updateFeature: async (featureId: string, data: UpdateFeatureDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<FeatureView>>(
      `${FEATURE_BASE_URL}/${encodeURIComponent(featureId)}`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  deleteFeature: async (featureId: string, idempotencyKey: string) => {
    await axiosClient.delete(`${FEATURE_BASE_URL}/${encodeURIComponent(featureId)}`, {
      headers: { "x-idempotency-key": idempotencyKey }
    });
  },

  // --- 2 Tier-Feature Grant Routes ---
  getTierGrants: async (tierId: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<TierFeatureGrantView[]>>(
      `${TIER_BASE_URL}/${encodeURIComponent(tierId)}/features`,
      signal,
    );
    return extractCoreData(response);
  },

  replaceTierGrants: async (tierId: string, data: SetTierFeaturesDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<TierFeatureGrantView[]>>(
      `${TIER_BASE_URL}/${encodeURIComponent(tierId)}/features`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  // --- 2 Graduated Price Ladder Routes ---
  getPriceLadder: async (tierId: string, billingCycle?: BillingCycle, signal?: AbortSignal) => {
    const qs = billingCycle ? `?billingCycle=${encodeURIComponent(billingCycle)}` : "";
    const response = await getWithSignal<SuccessResponse<PriceTierView[]>>(
      `${TIER_BASE_URL}/${encodeURIComponent(tierId)}/price-tiers${qs}`,
      signal,
    );
    return extractCoreData(response);
  },

  replacePriceLadder: async (tierId: string, data: SetPriceTiersDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<PriceTierView[]>>(
      `${TIER_BASE_URL}/${encodeURIComponent(tierId)}/price-tiers`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  // --- 2 Audit Routes ---
  getGlobalAudit: async (query?: CatalogueAuditQueryDto) => {
    const qs = toQueryString(query);
    const response = await axiosClient.get<SuccessResponse<CatalogueAuditPageView>>(`${AUDIT_BASE_URL}${qs}`);
    return extractCoreData(response);
  },

  getApplicationAudit: async (applicationId: string, query?: CatalogueAuditQueryDto, signal?: AbortSignal) => {
    const qs = toQueryString(query);
    const response = await getWithSignal<SuccessResponse<CatalogueAuditPageView>>(
      `${BASE_URL}/${encodeURIComponent(applicationId)}/audit${qs}`,
      signal,
    );
    return extractCoreData(response);
  },

  // --- 3 Managed Currency Rates Routes ---
  listCurrencyRates: async () => {
    const response = await axiosClient.get<SuccessResponse<CurrencyRateView[]>>(CURRENCY_BASE_URL);
    return extractCoreData(response);
  },

  upsertCurrencyRate: async (currencyCode: string, data: UpsertCurrencyRateDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<CurrencyRateView>>(
      `${CURRENCY_BASE_URL}/${encodeURIComponent(currencyCode.trim().toUpperCase())}`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  batchUpsertCurrencyRates: async (data: SetCurrencyRatesDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<CurrencyRateView[]>>(
      CURRENCY_BASE_URL,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  }
};
