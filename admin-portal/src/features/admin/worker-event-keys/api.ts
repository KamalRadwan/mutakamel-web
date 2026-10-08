import { axiosClient } from "@/lib/api/axiosClient";
import { envelopeData, readConfiguredKey, readWorkerKey, validateAdoption, UUID_V7, type AdoptWorkerKey } from "./contract";

export const WORKER_EVENT_KEYS_URL = "/api/admin/core/v1/provisioning/worker-event-verification-keys";
export const workerEventKeysApi = {
  async configured(signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(`${WORKER_EVENT_KEYS_URL}/configured`, { cache: "no-store", signal });
    const rows = envelopeData(response.data);
    if (!Array.isArray(rows)) throw new Error("INVALID_WORKER_EVENT_KEY_RESPONSE");
    const keys = rows.map(readConfiguredKey);
    if (keys.filter((key) => key.trustSlot === "ACTIVE").length !== 1
      || keys.filter((key) => key.trustSlot === "PREVIOUS").length > 1) throw new Error("INVALID_WORKER_EVENT_KEY_RESPONSE");
    return keys;
  },
  async list(signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(WORKER_EVENT_KEYS_URL, { cache: "no-store", signal });
    const rows = envelopeData(response.data);
    if (!Array.isArray(rows)) throw new Error("INVALID_WORKER_EVENT_KEY_RESPONSE");
    return rows.map(readWorkerKey);
  },
  async adopt(draft: AdoptWorkerKey, idempotencyKey: string) {
    if (Object.keys(validateAdoption(draft)).length || !UUID_V7.test(idempotencyKey)) throw new Error("INVALID_WORKER_EVENT_KEY_COMMAND");
    const { trustSlot, expectedIssuer, expectedKeyId, expectedPublicKeyFingerprint } = draft;
    const response = await axiosClient.post<unknown>(`${WORKER_EVENT_KEYS_URL}/adopt-configured`,
      { trustSlot, expectedIssuer, expectedKeyId, expectedPublicKeyFingerprint }, {
        headers: { "x-idempotency-key": idempotencyKey }, skipAutoIdempotency: true,
        replayAfterRefresh: true, cache: "no-store",
      });
    return readWorkerKey(envelopeData(response.data));
  },
};
