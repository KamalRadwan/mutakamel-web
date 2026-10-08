import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { workerEventKeysApi, WORKER_EVENT_KEYS_URL } from "./api";

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn(), post: vi.fn() } }));
const identity = { trustSlot: "ACTIVE" as const, issuer: "worker", keyId: "worker.1", algorithm: "RS256", publicKeyFingerprint: "a".repeat(64) };
const dto = { trustSlot: "ACTIVE" as const, expectedIssuer: "worker", expectedKeyId: "worker.1", expectedPublicKeyFingerprint: "a".repeat(64) };
const command = "019f0000-0000-7000-8000-000000000001";
const record = { ...identity, verificationKeyId: command, status: "ACTIVE", revision: 1, registeredAt: "2026-09-29T00:00:00Z" };
const response = (data: unknown) => ({ data: { success: true, data }, status: 200, statusText: "OK", headers: new Headers() });

describe("Worker verification-key API", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads configured identities through the shared canonical client and strips key material", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue(response([{ ...identity, publicKeySpkiDerBase64: "never-retain" }]));
    expect(await workerEventKeysApi.configured()).toEqual([identity]);
    expect(axiosClient.get).toHaveBeenCalledWith(`${WORKER_EVENT_KEYS_URL}/configured`, { cache: "no-store", signal: undefined });
  });

  it.each([[], [identity, identity], [{ ...identity, publicKeyFingerprint: "invalid" }]].map((data) => ({ data })))("fails closed on malformed configured identities", async ({ data }) => {
    vi.mocked(axiosClient.get).mockResolvedValue(response(data));
    await expect(workerEventKeysApi.configured()).rejects.toThrow("INVALID_WORKER_EVENT_KEY_RESPONSE");
  });

  it("submits only exact confirmation fields with the caller's stable command ID", async () => {
    vi.mocked(axiosClient.post).mockResolvedValue(response(record));
    await workerEventKeysApi.adopt({ ...dto, publicKey: "not-allowed" } as typeof dto, command);
    expect(axiosClient.post).toHaveBeenCalledWith(`${WORKER_EVENT_KEYS_URL}/adopt-configured`, dto, {
      headers: { "x-idempotency-key": command }, skipAutoIdempotency: true, replayAfterRefresh: true, cache: "no-store",
    });
  });

  it("rejects invalid confirmation or command identity before writing", async () => {
    await expect(workerEventKeysApi.adopt(dto, "not-a-uuid")).rejects.toThrow();
    await expect(workerEventKeysApi.adopt({ ...dto, expectedKeyId: " " }, command)).rejects.toThrow();
    expect(axiosClient.post).not.toHaveBeenCalled();
  });
});
