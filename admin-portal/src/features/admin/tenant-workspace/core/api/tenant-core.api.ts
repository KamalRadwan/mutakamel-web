import { axiosClient } from "@/lib/api/axiosClient";
import {
  extractCoreData,
  type SuccessResponse,
} from "@/shared/api/core-envelope";
import {
  readFqdnAvailability,
  readTenantFqdn,
  readTenantFqdnList,
  readTenantProvisioningCommandResult,
  readTenantView,
} from "../model/readers";
import type {
  FqdnAvailabilityResult,
  TenantFqdnView,
  TenantProvisioningCommandResult,
  TenantView,
  UpdateTenantProfileDto,
} from "../types";

const TENANTS_URL = "/api/admin/core/v1/tenants";
const FQDN_PREFLIGHT_URL = "/api/admin/core/v1/tenant-fqdns/validate";

function keyed(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

export const tenantCoreApi = {
  get: async (tenantId: string, signal?: AbortSignal): Promise<TenantView> => {
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}`,
      { signal },
    );
    return readTenantView(extractCoreData(response));
  },

  listFqdns: async (
    tenantId: string,
    signal?: AbortSignal,
  ): Promise<TenantFqdnView[]> => {
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}/fqdns`,
      { signal },
    );
    return readTenantFqdnList(extractCoreData(response));
  },

  updateProfile: async (
    tenantId: string,
    dto: UpdateTenantProfileDto,
    idempotencyKey: string,
  ): Promise<TenantView> => {
    const response = await axiosClient.patch<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}`,
      dto,
      keyed(idempotencyKey),
    );
    return readTenantView(extractCoreData(response));
  },

  suspend: async (
    tenantId: string,
    idempotencyKey: string,
  ): Promise<TenantView> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}/suspend`,
      undefined,
      keyed(idempotencyKey),
    );
    return readTenantView(extractCoreData(response));
  },

  activate: async (
    tenantId: string,
    idempotencyKey: string,
  ): Promise<TenantView> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}/activate`,
      undefined,
      keyed(idempotencyKey),
    );
    return readTenantView(extractCoreData(response));
  },

  reprovision: async (
    tenantId: string,
    idempotencyKey: string,
  ): Promise<TenantProvisioningCommandResult> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}/reprovision`,
      undefined,
      keyed(idempotencyKey),
    );
    return readTenantProvisioningCommandResult(extractCoreData(response));
  },

  cancelProvisioning: async (
    tenantId: string,
    idempotencyKey: string,
  ): Promise<TenantProvisioningCommandResult> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}/provisioning/cancel`,
      undefined,
      keyed(idempotencyKey),
    );
    return readTenantProvisioningCommandResult(extractCoreData(response));
  },

  /**
   * Reverses a soft delete. Core returns the tenant as SUSPENDED, so the
   * response is the authority on the landing state rather than the caller.
   */
  restore: async (
    tenantId: string,
    idempotencyKey: string,
  ): Promise<TenantView> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}/restore`,
      undefined,
      keyed(idempotencyKey),
    );
    return readTenantView(extractCoreData(response));
  },

  softDelete: async (
    tenantId: string,
    idempotencyKey: string,
  ): Promise<void> => {
    await axiosClient.delete(
      `${TENANTS_URL}/${tenantId}`,
      keyed(idempotencyKey),
    );
  },

  destroy: async (
    tenantId: string,
    destroySubscriptions: boolean,
    idempotencyKey: string,
  ): Promise<void> => {
    const query = new URLSearchParams({
      destroySubscriptions: destroySubscriptions ? "true" : "false",
    });
    await axiosClient.delete(
      `${TENANTS_URL}/${tenantId}/destroy?${query.toString()}`,
      keyed(idempotencyKey),
    );
  },

  validateFqdn: async (
    fqdn: string,
    signal?: AbortSignal,
  ): Promise<FqdnAvailabilityResult> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      FQDN_PREFLIGHT_URL,
      { fqdn },
      { signal, skipAutoIdempotency: true },
    );
    return readFqdnAvailability(extractCoreData(response));
  },

  addFqdn: async (
    tenantId: string,
    fqdn: string,
    idempotencyKey: string,
  ): Promise<TenantFqdnView> => {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${TENANTS_URL}/${tenantId}/fqdns`,
      { fqdn },
      keyed(idempotencyKey),
    );
    return readTenantFqdn(extractCoreData(response));
  },

  removeFqdn: async (
    tenantId: string,
    fqdnId: string,
    idempotencyKey: string,
  ): Promise<void> => {
    await axiosClient.delete(
      `${TENANTS_URL}/${tenantId}/fqdns/${fqdnId}`,
      keyed(idempotencyKey),
    );
  },

  promoteFqdn: async (
    tenantId: string,
    fqdnId: string,
    idempotencyKey: string,
  ): Promise<void> => {
    await axiosClient.post(
      `${TENANTS_URL}/${tenantId}/fqdns/${fqdnId}/primary`,
      undefined,
      keyed(idempotencyKey),
    );
  },
};
