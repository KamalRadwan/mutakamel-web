import { axiosClient } from "@/lib/api/axiosClient";
import {
  readReleaseDraftList,
  readReleaseDraftSnapshot,
  readReleaseList,
  readReleaseSnapshot,
  readReleaseValidationSnapshot,
} from "../model/release-readers";
import type {
  CreateReleaseDraftDto,
  PublishReleaseDraftDto,
  RetireReleaseDto,
  UpdateReleaseDraftDto,
  ValidateReleaseDraftDto,
} from "../types/provisioning-releases";

const BASE = "/api/admin/core/v1/provisioning";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const provisioningReleasesApi = {
  listDrafts: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(`${BASE}/release-drafts`, noStore(signal));
    return readReleaseDraftList(response.data);
  },
  createDraft: async (dto: CreateReleaseDraftDto, key: string) => {
    const response = await axiosClient.post<unknown>(
      `${BASE}/release-drafts`,
      dto,
      command(key),
    );
    return readReleaseDraftSnapshot(response.data);
  },
  getDraft: async (draftId: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(draftUrl(draftId), noStore(signal));
    return readDraftForId(response.data, draftId);
  },
  updateDraft: async (draftId: string, dto: UpdateReleaseDraftDto, key: string) => {
    const response = await axiosClient.patch<unknown>(draftUrl(draftId), dto, command(key));
    return readDraftForId(response.data, draftId);
  },
  validateDraft: async (
    draftId: string,
    dto: ValidateReleaseDraftDto,
    key: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${draftUrl(draftId)}/validate`,
      dto,
      command(key),
    );
    const result = readReleaseValidationSnapshot(response.data);
    if (result.data.draftId !== draftId.toLowerCase()) invalidResponse();
    return result;
  },
  publishDraft: async (
    draftId: string,
    dto: PublishReleaseDraftDto,
    key: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${draftUrl(draftId)}/publish`,
      dto,
      command(key),
    );
    return readReleaseSnapshot(response.data);
  },
  listReleases: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(`${BASE}/releases`, noStore(signal));
    return readReleaseList(response.data);
  },
  getRelease: async (releaseId: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(releaseUrl(releaseId), noStore(signal));
    return readReleaseForId(response.data, releaseId);
  },
  retireRelease: async (releaseId: string, dto: RetireReleaseDto, key: string) => {
    const response = await axiosClient.post<unknown>(
      `${releaseUrl(releaseId)}/retire`,
      dto,
      command(key),
    );
    return readReleaseForId(response.data, releaseId);
  },
};

function noStore(signal?: AbortSignal) {
  return { cache: "no-store" as const, ...(signal ? { signal } : {}) };
}

function command(key: string) {
  if (!UUID_V7.test(key)) {
    throw new Error("INVALID_PROVISIONING_RELEASE_IDEMPOTENCY_KEY");
  }
  return { headers: { "x-idempotency-key": key.toLowerCase() } };
}

function draftUrl(draftId: string): string {
  return `${BASE}/release-drafts/${resourceId(draftId)}`;
}

function releaseUrl(releaseId: string): string {
  return `${BASE}/releases/${resourceId(releaseId)}`;
}

function resourceId(value: string): string {
  if (!UUID_V7.test(value)) throw new Error("INVALID_PROVISIONING_RELEASE_ID");
  return encodeURIComponent(value.toLowerCase());
}

function readDraftForId(payload: unknown, expectedId: string) {
  const result = readReleaseDraftSnapshot(payload);
  if (result.data.draftId !== expectedId.toLowerCase()) invalidResponse();
  return result;
}

function readReleaseForId(payload: unknown, expectedId: string) {
  const result = readReleaseSnapshot(payload);
  if (result.data.releaseId !== expectedId.toLowerCase()) invalidResponse();
  return result;
}

function invalidResponse(): never {
  throw new Error("INVALID_PROVISIONING_RELEASE_RESPONSE");
}
