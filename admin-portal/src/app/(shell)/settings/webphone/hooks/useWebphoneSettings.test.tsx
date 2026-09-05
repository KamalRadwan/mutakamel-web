// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: ["admin.webphone.read", "admin.webphone.update"],
    },
    isLoading: false,
  },
}));

vi.mock("@mutakamel/webphone", () => ({ notifyWebphoneChanged: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  unwrapCoreData: (payload: unknown) =>
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload,
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));

import { useWebphoneSettings } from "./useWebphoneSettings";

const TURN_URL = "turn:turn.example.com:3478";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const SERVERS = [
  {
    id: "s1",
    name: "Primary",
    sipDomain: "sip.example.com",
    websocketUrl: "wss://primary.example.com/ws",
    priority: 0,
    enabled: true,
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 600,
    defaultCallerId: null,
    iceTransportPolicy: "all",
    iceEnabled: true,
    traceSip: false,
    sessionTimers: false,
    allowInvalidTlsCertificate: false,
    defaultTimeoutSeconds: 15,
    defaultMaxRetries: 1,
    iceServers: [
      {
        id: "i1",
        kind: "TURN",
        urls: [TURN_URL],
        username: "turnuser",
        credentialConfigured: true,
        enabled: true,
        sortOrder: 0,
      },
    ],
  },
];

/** The server is unreachable, so the write's outcome is unknown. */
const UNREACHABLE = {
  response: {
    status: 503,
    data: { success: false, errorCode: "CORE_DOWN", message: "unreachable" },
  },
};

function iceUpdate(credential: string) {
  return {
    kind: "TURN" as const,
    urls: [TURN_URL],
    username: "turnuser",
    credential,
  };
}

function keyOf(call: number) {
  return api.patch.mock.calls[call][2].headers["x-idempotency-key"];
}

beforeEach(() => {
  api.get.mockReset().mockImplementation((url: string) => {
    if (url.endsWith("/servers")) {
      return Promise.resolve({ data: { data: SERVERS } });
    }
    throw new Error(`unexpected request: ${url}`);
  });
  api.post.mockReset();
  api.patch.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe("useWebphoneSettings TURN credential intent", () => {
  it("retries the same credential under one key and a replacement under a new one", async () => {
    api.patch.mockRejectedValue(UNREACHABLE);

    const { result } = renderHook(() => useWebphoneSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    // The write may or may not have landed, so its key is kept: an identical
    // retry has to reconcile that attempt rather than open a second one.
    await act(async () => {
      expect(
        await result.current.updateIceServer("s1", "i1", iceUpdate("alpha")),
      ).toBe(false);
    });
    await act(async () => {
      expect(
        await result.current.updateIceServer("s1", "i1", iceUpdate("alpha")),
      ).toBe(false);
    });
    expect(api.patch).toHaveBeenCalledTimes(2);
    expect(keyOf(0)).toMatch(UUID_V7);
    expect(keyOf(1)).toBe(keyOf(0));

    // A different credential is a different command. The Gateway hashes the
    // real body, so sending it under the previous credential's key is refused
    // as a mismatch — the operator's first attempt to rotate the secret fails
    // for a reason nothing on the screen can explain.
    await act(async () => {
      expect(
        await result.current.updateIceServer("s1", "i1", iceUpdate("beta")),
      ).toBe(false);
    });
    expect(api.patch).toHaveBeenCalledTimes(3);
    expect(keyOf(2)).toMatch(UUID_V7);
    expect(keyOf(2)).not.toBe(keyOf(0));

    // Redaction is a fingerprint concern only: the wire still carries the
    // credential the operator typed.
    expect(api.patch.mock.calls[0][1]).toEqual(iceUpdate("alpha"));
    expect(api.patch.mock.calls[2][1]).toEqual(iceUpdate("beta"));
  });

  it("gives a new ICE entry a new key when only its credential differs", async () => {
    api.post.mockRejectedValue(UNREACHABLE);

    const { result } = renderHook(() => useWebphoneSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    const draft = (credential: string) => ({
      kind: "TURN" as const,
      urls: [TURN_URL],
      username: "turnuser",
      credential,
      enabled: true,
      sortOrder: 1,
    });

    await act(async () => {
      expect(await result.current.createIceServer("s1", draft("alpha"))).toBe(
        false,
      );
    });
    await act(async () => {
      expect(await result.current.createIceServer("s1", draft("beta"))).toBe(
        false,
      );
    });

    const keys = api.post.mock.calls.map(
      (call) => call[2].headers["x-idempotency-key"],
    );
    expect(keys[0]).toMatch(UUID_V7);
    expect(keys[1]).toMatch(UUID_V7);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
