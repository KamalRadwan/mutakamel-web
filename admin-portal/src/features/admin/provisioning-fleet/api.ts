import { axiosClient } from "@/lib/api/axiosClient";
import {
  assertAttestationCommand,
  assertManageCommand,
  assertPreviewCommand,
  assertRolloutCommand,
  readPreviewEnvelope,
  readPreviewTenantPage,
  readReportEnvelope,
  readRolloutEnvelope,
  readRolloutTenantPage,
  readRolloutsEnvelope,
  requireUuidV7,
  validatePageQuery,
} from "./contracts";
import type {
  AttestFleetReportCommand,
  CreateFleetPreviewCommand,
  CreateFleetRolloutCommand,
  FleetManageAction,
  ManageFleetRolloutCommand,
} from "./types";

const PROVISIONING_FLEET_ROOT = "/api/admin/core/v1/provisioning";

function readConfig(signal?: AbortSignal) {
  return {
    cache: "no-store" as const,
    ...(signal ? { signal } : {}),
  };
}

function commandConfig(idempotencyKey: string) {
  return {
    cache: "no-store" as const,
    headers: {
      "x-idempotency-key": requireUuidV7(
        idempotencyKey,
        "INVALID_FLEET_IDEMPOTENCY_KEY",
      ),
    },
    skipAutoIdempotency: true,
    replayAfterRefresh: true,
  };
}

export const provisioningFleetApi = {
  createPreview: async (
    command: CreateFleetPreviewCommand,
    idempotencyKey: string,
  ) => {
    assertPreviewCommand(command);
    const response = await axiosClient.post<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollout-previews`,
      command,
      commandConfig(idempotencyKey),
    );
    return readPreviewEnvelope(response.data);
  },

  getPreview: async (previewId: string, signal?: AbortSignal) => {
    const id = requireUuidV7(previewId, "INVALID_FLEET_PREVIEW_ID");
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollout-previews/${id}`,
      readConfig(signal),
    );
    return readPreviewEnvelope(response.data);
  },

  listPreviewTenants: async (
    previewId: string,
    page: number,
    limit: number,
    signal?: AbortSignal,
  ) => {
    const id = requireUuidV7(previewId, "INVALID_FLEET_PREVIEW_ID");
    validatePageQuery(page, limit);
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollout-previews/${id}/tenants?page=${page}&limit=${limit}`,
      readConfig(signal),
    );
    return readPreviewTenantPage(response.data);
  },

  listRollouts: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollouts`,
      readConfig(signal),
    );
    return readRolloutsEnvelope(response.data);
  },

  createRollout: async (
    command: CreateFleetRolloutCommand,
    idempotencyKey: string,
  ) => {
    assertRolloutCommand(command);
    const response = await axiosClient.post<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollouts`,
      command,
      commandConfig(idempotencyKey),
    );
    return readRolloutEnvelope(response.data);
  },

  getRollout: async (rolloutId: string, signal?: AbortSignal) => {
    const id = requireUuidV7(rolloutId, "INVALID_FLEET_ROLLOUT_ID");
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollouts/${id}`,
      readConfig(signal),
    );
    return readRolloutEnvelope(response.data);
  },

  listRolloutTenants: async (
    rolloutId: string,
    page: number,
    limit: number,
    signal?: AbortSignal,
  ) => {
    const id = requireUuidV7(rolloutId, "INVALID_FLEET_ROLLOUT_ID");
    validatePageQuery(page, limit);
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollouts/${id}/tenants?page=${page}&limit=${limit}`,
      readConfig(signal),
    );
    return readRolloutTenantPage(response.data);
  },

  manageRollout: async (
    rolloutId: string,
    action: FleetManageAction,
    command: ManageFleetRolloutCommand,
    idempotencyKey: string,
  ) => {
    const id = requireUuidV7(rolloutId, "INVALID_FLEET_ROLLOUT_ID");
    assertManageCommand(command);
    const response = await axiosClient.post<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollouts/${id}/${action}`,
      command,
      commandConfig(idempotencyKey),
    );
    return readRolloutEnvelope(response.data);
  },

  getReport: async (rolloutId: string, signal?: AbortSignal) => {
    const id = requireUuidV7(rolloutId, "INVALID_FLEET_ROLLOUT_ID");
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollouts/${id}/report`,
      readConfig(signal),
    );
    return readReportEnvelope(response.data);
  },

  attestReport: async (
    rolloutId: string,
    command: AttestFleetReportCommand,
    idempotencyKey: string,
  ) => {
    const id = requireUuidV7(rolloutId, "INVALID_FLEET_ROLLOUT_ID");
    assertAttestationCommand(command);
    const response = await axiosClient.post<unknown>(
      `${PROVISIONING_FLEET_ROOT}/fleet-rollouts/${id}/report/attest`,
      command,
      commandConfig(idempotencyKey),
    );
    return readReportEnvelope(response.data);
  },
};
