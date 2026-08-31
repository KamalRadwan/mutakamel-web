import { axiosClient } from "@/lib/api/axiosClient";
import {
  extractCoreData,
  type SuccessResponse,
} from "@/shared/api/core-envelope";
import {
  readDatabasePlacementOptions,
  readProvisioningPlanPreview,
  readSubscriptionQuote,
  readTenantCreateOptions,
  readTenantCreateResult,
  readTenantIdentityValidation,
} from "../lib/tenant-registration";
import { readTenantReverseGeocodedAddress } from "../lib/tenant-reverse-geocode";
import { readTenantCreateStatus } from "../lib/tenant-create-recovery";
import type {
  TenantBillingCycle,
  TenantCreateCommand,
  TenantProvisioningPlanPreview,
  ReverseGeocodeTenantAddressDto,
  TenantSubscriptionLine,
  TenantSubscriptionQuote,
  ValidateTenantIdentityDto,
} from "../types";

const TENANTS_BASE_URL = "/api/admin/core/v1/tenants";
const QUOTE_URL = "/api/admin/core/v1/subscriptions/quote";

export const tenantRegistrationApi = {
  validateIdentity: async (
    dto: ValidateTenantIdentityDto,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_BASE_URL}/validate-identity`,
      dto,
      {
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        signal,
      },
    );
    return readTenantIdentityValidation(extractCoreData(response));
  },

  reverseGeocode: async (
    dto: ReverseGeocodeTenantAddressDto,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_BASE_URL}/reverse-geocode`,
      dto,
      {
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        ...(signal ? { signal } : {}),
      },
    );
    return readTenantReverseGeocodedAddress(extractCoreData(response));
  },

  listCandidateApplications: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${TENANTS_BASE_URL}/create-options`,
      { signal },
    );
    return readTenantCreateOptions(extractCoreData(response));
  },

  listDatabasePlacementOptions: async (applicationKeys: readonly string[]) => {
    const keys = [...new Set(applicationKeys)].sort();
    const params = new URLSearchParams({ applicationKeys: keys.join(",") });
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${TENANTS_BASE_URL}/database-placement-options?${params.toString()}`,
    );
    return readDatabasePlacementOptions(extractCoreData(response));
  },

  previewProvisioningPlan: async (
    applicationKeys: readonly string[],
  ): Promise<TenantProvisioningPlanPreview> => {
    const keys = [...new Set(applicationKeys)].sort();
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_BASE_URL}/provisioning-plans`,
      { moduleKeys: keys },
      { skipAutoIdempotency: true, replayAfterRefresh: true },
    );
    return readProvisioningPlanPreview(extractCoreData(response), keys);
  },

  quote: async (
    lines: readonly TenantSubscriptionLine[],
    billingCycle: TenantBillingCycle,
    signal?: AbortSignal,
  ): Promise<TenantSubscriptionQuote> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      QUOTE_URL,
      {
        billingCycle,
        currencyCode: "USD",
        items: lines.map((line) => ({
          moduleId: line.applicationId,
          tierId: line.tierId,
          seats: line.seats,
        })),
      },
      {
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        ...(signal ? { signal } : {}),
      },
    );
    return readSubscriptionQuote(
      extractCoreData(response),
      lines,
      billingCycle,
    );
  },

  findCreateStatus: async (tenantName: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      page: "1",
      limit: "20",
      search: tenantName,
      sortBy: "createdAt",
      sortDir: "DESC",
    });
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${TENANTS_BASE_URL}?${params.toString()}`,
      { signal },
    );
    return readTenantCreateStatus(extractCoreData(response), tenantName);
  },

  create: async (command: TenantCreateCommand, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      TENANTS_BASE_URL,
      command,
      { headers: { "x-idempotency-key": idempotencyKey } },
    );
    return readTenantCreateResult(extractCoreData(response));
  },
};
