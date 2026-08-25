import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { PUBLISHER_KEYS_URL, publisherKeysApi } from "./api";
import {
  ACTIVE_KEY,
  CHALLENGE,
  CHALLENGE_ID,
  IDEMPOTENCY_KEY,
  PUBLIC_KEY,
  PUBLISHER_KEY_ID,
  SIGNATURE,
  envelope,
} from "./test-fixtures";

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: vi.fn(), post: vi.fn() },
}));

const getMock = vi.mocked(axiosClient.get);
const postMock = vi.mocked(axiosClient.post);

function response(data: unknown, status = 200) {
  return { data, status, statusText: "OK", headers: new Headers() };
}

describe("publisherKeysApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reaches both exact no-store GET contracts", async () => {
    getMock
      .mockResolvedValueOnce(response(envelope([ACTIVE_KEY])))
      .mockResolvedValueOnce(response(envelope(ACTIVE_KEY)));
    const controller = new AbortController();

    await publisherKeysApi.list(controller.signal);
    await publisherKeysApi.get(PUBLISHER_KEY_ID, controller.signal);

    expect(getMock).toHaveBeenNthCalledWith(1, PUBLISHER_KEYS_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${PUBLISHER_KEYS_URL}/${PUBLISHER_KEY_ID}`,
      { cache: "no-store", signal: controller.signal },
    );
  });

  it("reaches all three exact POST contracts with caller-owned UUIDv7", async () => {
    postMock
      .mockResolvedValueOnce(response(envelope(CHALLENGE)))
      .mockResolvedValueOnce(response(envelope(ACTIVE_KEY), 201))
      .mockResolvedValueOnce(
        response(envelope({
          ...ACTIVE_KEY,
          status: "REVOKED",
          revision: 2,
          revokedAt: "2026-08-12T12:30:00.000Z",
          revocationReasonCode: "KEY_ROTATED",
        })),
      );
    const challenge = {
      keyId: "core-release-primary",
      publicKeyBase64: PUBLIC_KEY,
      expiresInSeconds: 300,
    } as const;
    const register = {
      challengeId: CHALLENGE_ID,
      proofSignatureBase64: SIGNATURE,
    } as const;
    const revoke = {
      expectedRevision: 1,
      expectedStatus: "ACTIVE",
      reasonCode: "KEY_ROTATED",
    } as const;

    await publisherKeysApi.createChallenge(challenge, IDEMPOTENCY_KEY);
    await publisherKeysApi.register(register, IDEMPOTENCY_KEY);
    await publisherKeysApi.revoke(
      PUBLISHER_KEY_ID,
      revoke,
      IDEMPOTENCY_KEY,
    );

    const config = {
      headers: { "x-idempotency-key": IDEMPOTENCY_KEY },
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
      cache: "no-store",
    };
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      `${PUBLISHER_KEYS_URL}/challenges`,
      challenge,
      config,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      PUBLISHER_KEYS_URL,
      register,
      config,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      3,
      `${PUBLISHER_KEYS_URL}/${PUBLISHER_KEY_ID}/revoke`,
      revoke,
      config,
    );
  });

  it("rejects invalid route IDs, keys, and widened bodies before transport", async () => {
    await expect(
      publisherKeysApi.get("not-a-v7"),
    ).rejects.toThrow("INVALID_PUBLISHER_KEY_ID");
    await expect(
      publisherKeysApi.register(
        {
          challengeId: CHALLENGE_ID,
          proofSignatureBase64: SIGNATURE,
          extra: true,
        } as never,
        IDEMPOTENCY_KEY,
      ),
    ).rejects.toThrow("INVALID_PUBLISHER_KEY_REGISTRATION");
    await expect(
      publisherKeysApi.createChallenge(
        {
          keyId: "core-release-primary",
          publicKeyBase64: PUBLIC_KEY,
          expiresInSeconds: 300,
        },
        "not-a-v7",
      ),
    ).rejects.toThrow("INVALID_IDEMPOTENCY_KEY");
    expect(postMock).not.toHaveBeenCalled();
  });
});
