import { axiosClient } from "@/lib/api/axiosClient";
import { extractCoreData, extractCoreMeta } from "@/shared/api/core-envelope";
import type { SuccessResponse } from "@/types/common";
import {
  readManagedProvisioningOperation,
  readProvisioningPage,
  readSeedConflictResolution,
  readTenantAvailableUpdate,
  readTenantComponentInstallation,
  readTenantOperationDetail,
  readTenantOperationSummary,
  readTenantOperationTimelineEvent,
  readTenantPrerequisiteEvidenceRecord,
  readTenantPrerequisiteRequest,
  readTenantProvisioningCommandResult,
  readTenantSeedState,
} from "../model/readers";
import type {
  ApplyTenantUpdatesDto,
  CreateAddApplicationOperationDto,
  CreateDecommissionOperationDto,
  CreateRepairOperationDto,
  RequestTenantPrerequisiteDto,
  ResolveTenantSeedConflictDto,
  TenantAvailableUpdateQuery,
  TenantComponentStateQuery,
  TenantOperationQuery,
  TenantOperationTimelineQuery,
  TenantSeedStateQuery,
} from "../types";

const TENANTS_ROOT = "/api/admin/core/v1/tenants";

function tenantRoot(tenantId: string): string {
  return `${TENANTS_ROOT}/${encodeURIComponent(tenantId)}`;
}

function provisioningRoot(tenantId: string): string {
  return `${tenantRoot(tenantId)}/provisioning`;
}

function commandConfig(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

function queryString(values: object): string {
  const parameters = new URLSearchParams();
  Object.entries(values as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        throw new Error("INVALID_PROVISIONING_QUERY_VALUE");
      }
      parameters.set(key, String(value));
    }
  });
  return parameters.size ? `?${parameters.toString()}` : "";
}

export const tenantProvisioningApi = {
  async listOperations(
    tenantId: string,
    query: TenantOperationQuery = {},
    signal?: AbortSignal,
  ) {
    const suffix = queryString(query);
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${tenantRoot(tenantId)}/operations${suffix}`,
      { signal },
    );
    return readProvisioningPage(
      extractCoreData(response),
      extractCoreMeta(response),
      readTenantOperationSummary,
      "INVALID_TENANT_OPERATIONS_PAGE_RESPONSE",
    );
  },

  async getOperation(
    tenantId: string,
    operationId: string,
    signal?: AbortSignal,
  ) {
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${tenantRoot(tenantId)}/operations/${encodeURIComponent(operationId)}`,
      { signal },
    );
    return readTenantOperationDetail(extractCoreData(response));
  },

  async listTimeline(
    tenantId: string,
    operationId: string,
    query: TenantOperationTimelineQuery = {},
    signal?: AbortSignal,
  ) {
    const suffix = queryString(query);
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${tenantRoot(tenantId)}/operations/${encodeURIComponent(operationId)}/timeline${suffix}`,
      { signal },
    );
    return readProvisioningPage(
      extractCoreData(response),
      extractCoreMeta(response),
      readTenantOperationTimelineEvent,
      "INVALID_TENANT_OPERATION_TIMELINE_PAGE_RESPONSE",
    );
  },

  async retryOperation(
    tenantId: string,
    operationId: string,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${tenantRoot(tenantId)}/operations/${encodeURIComponent(operationId)}/retry`,
      {},
      commandConfig(idempotencyKey),
    );
    return readTenantProvisioningCommandResult(extractCoreData(response));
  },

  async cancelOperation(
    tenantId: string,
    operationId: string,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${tenantRoot(tenantId)}/operations/${encodeURIComponent(operationId)}/cancel`,
      {},
      commandConfig(idempotencyKey),
    );
    return readTenantProvisioningCommandResult(extractCoreData(response));
  },

  async listUpdates(
    tenantId: string,
    query: TenantAvailableUpdateQuery = {},
    signal?: AbortSignal,
  ) {
    const suffix = queryString(query);
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/updates${suffix}`,
      { signal },
    );
    return readProvisioningPage(
      extractCoreData(response),
      extractCoreMeta(response),
      readTenantAvailableUpdate,
      "INVALID_TENANT_UPDATES_PAGE_RESPONSE",
    );
  },

  async applyUpdates(
    tenantId: string,
    dto: ApplyTenantUpdatesDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/updates/apply`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readTenantProvisioningCommandResult(extractCoreData(response));
  },

  async requestPrerequisites(
    tenantId: string,
    dto: RequestTenantPrerequisiteDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/prerequisite-requests`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readTenantPrerequisiteRequest(extractCoreData(response));
  },

  async listPrerequisiteEvidence(tenantId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/prerequisite-evidence`,
      { signal },
    );
    const data = extractCoreData(response);
    if (!Array.isArray(data)) {
      throw new Error("INVALID_TENANT_PREREQUISITE_EVIDENCE_RESPONSE");
    }
    return data.map(readTenantPrerequisiteEvidenceRecord);
  },

  async listComponents(
    tenantId: string,
    query: TenantComponentStateQuery = {},
    signal?: AbortSignal,
  ) {
    const suffix = queryString(query);
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${tenantRoot(tenantId)}/provisioning-state/components${suffix}`,
      { signal },
    );
    return readProvisioningPage(
      extractCoreData(response),
      extractCoreMeta(response),
      readTenantComponentInstallation,
      "INVALID_TENANT_COMPONENTS_PAGE_RESPONSE",
    );
  },

  async listSeeds(
    tenantId: string,
    query: TenantSeedStateQuery = {},
    signal?: AbortSignal,
  ) {
    const suffix = queryString(query);
    const response = await axiosClient.get<SuccessResponse<unknown>>(
      `${tenantRoot(tenantId)}/provisioning-state/seeds${suffix}`,
      { signal },
    );
    return readProvisioningPage(
      extractCoreData(response),
      extractCoreMeta(response),
      readTenantSeedState,
      "INVALID_TENANT_SEEDS_PAGE_RESPONSE",
    );
  },

  async addApplication(
    tenantId: string,
    dto: CreateAddApplicationOperationDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/operations/add-application`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readManagedProvisioningOperation(extractCoreData(response));
  },

  async repair(
    tenantId: string,
    dto: CreateRepairOperationDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/operations/repair`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readManagedProvisioningOperation(extractCoreData(response));
  },

  async decommission(
    tenantId: string,
    dto: CreateDecommissionOperationDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/operations/decommission`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readManagedProvisioningOperation(extractCoreData(response));
  },

  async resolveSeedConflict(
    tenantId: string,
    seedStateId: string,
    dto: ResolveTenantSeedConflictDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<SuccessResponse<unknown>>(
      `${provisioningRoot(tenantId)}/seed-conflicts/${encodeURIComponent(seedStateId)}/resolve`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readSeedConflictResolution(extractCoreData(response));
  },
};
