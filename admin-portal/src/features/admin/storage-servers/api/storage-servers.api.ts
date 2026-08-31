import { axiosClient } from "@/lib/api/axiosClient";
import { extractCoreData } from "@/shared/api/core-envelope";
import type { SuccessResponse } from "@/types/common";
import type {
  CreateStorageServerDto,
  ProbeStorageServerDto,
  RotateStorageCredentialsDto,
  StorageCredentialRotationView,
  StorageServerList,
  StorageServerListQuery,
  StorageServerProbeResult,
  StorageServerView,
  UpdateStorageServerDto,
} from "../types";

const ROOT = "/api/admin/core/v1/storage-servers";

function commandHeaders(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

export const storageServersApi = {
  async list(query: StorageServerListQuery = {}, signal?: AbortSignal) {
    const parameters = new URLSearchParams();
    if (query.page) parameters.set("page", String(query.page));
    if (query.limit) parameters.set("limit", String(query.limit));
    if (query.search) parameters.set("search", query.search);
    if (query.status) parameters.set("status", query.status);
    if (query.sortBy) parameters.set("sortBy", query.sortBy);
    if (query.sortDir) parameters.set("sortDir", query.sortDir);
    const suffix = parameters.size ? `?${parameters.toString()}` : "";
    const response = await axiosClient.get<SuccessResponse<StorageServerList>>(
      `${ROOT}${suffix}`,
      { signal },
    );
    return extractCoreData(response);
  },

  async get(id: string, signal?: AbortSignal) {
    const response = await axiosClient.get<SuccessResponse<StorageServerView>>(
      `${ROOT}/${encodeURIComponent(id)}`,
      { signal },
    );
    return extractCoreData(response);
  },

  async create(dto: CreateStorageServerDto, idempotencyKey: string) {
    const response = await axiosClient.post<SuccessResponse<StorageServerView>>(
      ROOT,
      dto,
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  async update(
    id: string,
    dto: UpdateStorageServerDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.patch<SuccessResponse<StorageServerView>>(
      `${ROOT}/${encodeURIComponent(id)}`,
      dto,
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  async activate(id: string, idempotencyKey: string) {
    const response = await axiosClient.post<SuccessResponse<StorageServerView>>(
      `${ROOT}/${encodeURIComponent(id)}/activate`,
      {},
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  async probe(
    id: string,
    dto: ProbeStorageServerDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<
      SuccessResponse<StorageServerProbeResult>
    >(
      `${ROOT}/${encodeURIComponent(id)}/probe`,
      dto,
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  async offline(id: string, idempotencyKey: string) {
    const response = await axiosClient.post<SuccessResponse<StorageServerView>>(
      `${ROOT}/${encodeURIComponent(id)}/offline`,
      {},
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  async drain(id: string, idempotencyKey: string) {
    const response = await axiosClient.post<SuccessResponse<StorageServerView>>(
      `${ROOT}/${encodeURIComponent(id)}/drain`,
      {},
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  /**
   * Zero-downtime credential rotation: stages the next credential, probes
   * it, activates it with a bounded grace window during which both the old
   * and new keys work. Distinct from `update({ credentials })`, which
   * replaces instantly and forces the server back to DRAFT.
   */
  async rotateCredentials(
    id: string,
    dto: RotateStorageCredentialsDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<
      SuccessResponse<StorageCredentialRotationView>
    >(
      `${ROOT}/${encodeURIComponent(id)}/credential-rotations`,
      dto,
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  /** Call once the grace window has expired to prove the previous credential is rejected. */
  async revokeCredentialRotation(
    id: string,
    rotationId: string,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<
      SuccessResponse<StorageCredentialRotationView>
    >(
      `${ROOT}/${encodeURIComponent(id)}/credential-rotations/${encodeURIComponent(rotationId)}/revoke`,
      {},
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  async delete(id: string, idempotencyKey: string) {
    await axiosClient.delete(
      `${ROOT}/${encodeURIComponent(id)}`,
      commandHeaders(idempotencyKey),
    );
  },
};
