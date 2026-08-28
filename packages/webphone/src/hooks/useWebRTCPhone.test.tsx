// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { endpointSocketWeight } from "../config";
import { WebphoneProvider } from "../context/WebphoneContext";
import { webphoneCopy } from "../copy";
import type { WebphoneHttpClient } from "../http";
import type { WebphoneMe } from "../types";

class MockWebSocketInterface {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
}

type Handler = (...args: unknown[]) => void;

class MockUA {
  static instances: MockUA[] = [];
  config: Record<string, unknown>;
  private handlers: Record<string, Handler[]> = {};

  constructor(config: Record<string, unknown>) {
    this.config = config;
    MockUA.instances.push(this);
  }

  on(event: string, handler: Handler) {
    (this.handlers[event] ??= []).push(handler);
    return this;
  }

  emit(event: string, payload?: unknown) {
    (this.handlers[event] ?? []).forEach((handler) => handler(payload));
  }

  start() {}
  stop() {}
  register() {}
  isRegistered() {
    return false;
  }
}

vi.mock("jssip", () => ({
  UA: MockUA,
  WebSocketInterface: MockWebSocketInterface,
}));

const BASE_PATH = "/api/admin/webphone/v1";

const getMock = vi.fn();
const httpClient = {
  get: getMock,
  post: vi.fn().mockResolvedValue({ data: { data: null } }),
} as unknown as WebphoneHttpClient;

const webphoneMe: WebphoneMe = {
  enabled: true,
  extension: "100",
  sipUsername: "100",
  sipPassword: "secret",
  displayName: "Operator",
  outboundCallerId: null,
  transport: "wss",
  passwordConfigured: true,
  config: {
    enabled: true,
    sipDomain: "example.com",
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 600,
    sessionTimers: false,
    traceSip: false,
    iceTransportPolicy: "all",
    endpoints: [{ websocketUrl: "wss://primary.example.com:8089/ws", priority: 0 }],
    iceServers: [],
  },
  turnCredentials: { enabled: false, iceServers: [], expiresAt: null },
};

function serveMe(me: WebphoneMe) {
  getMock.mockImplementation((url: string) =>
    url.endsWith("/call-logs")
      ? Promise.resolve({ data: { data: [] } })
      : Promise.resolve({ data: { data: me } }),
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <WebphoneProvider basePath={BASE_PATH} http={httpClient} active copy={webphoneCopy.en}>
      {children}
    </WebphoneProvider>
  );
}

async function renderPhone() {
  const { useWebRTCPhone } = await import("./useWebRTCPhone");
  return renderHook(() => useWebRTCPhone(), { wrapper });
}

describe("useWebRTCPhone connection lifecycle", () => {
  beforeEach(() => {
    MockUA.instances = [];
    getMock.mockReset();
    serveMe(webphoneMe);
  });

  it("builds one socket per endpoint returned by the runtime config", async () => {
    await renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    const sockets = MockUA.instances[0].config.sockets as Array<{ socket: MockWebSocketInterface; weight: number }>;
    expect(sockets).toHaveLength(1);
    expect(sockets[0].socket.url).toBe("wss://primary.example.com:8089/ws");
    expect(sockets[0].weight).toBe(endpointSocketWeight(0));
  });

  it("keeps the server's endpoint order while inverting priority into a JsSIP weight", async () => {
    serveMe({
      ...webphoneMe,
      config: {
        ...webphoneMe.config,
        endpoints: [
          { websocketUrl: "wss://primary.example.com:8089/ws", priority: 0 },
          { websocketUrl: "wss://backup.example.com:8089/ws", priority: 5 },
        ],
      },
    });
    await renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    const sockets = MockUA.instances[0].config.sockets as Array<{ socket: MockWebSocketInterface; weight: number }>;
    expect(sockets).toHaveLength(2);
    expect(sockets[0].socket.url).toBe("wss://primary.example.com:8089/ws");
    expect(sockets[1].socket.url).toBe("wss://backup.example.com:8089/ws");
    expect(sockets[0].weight).toBeGreaterThan(sockets[1].weight);
  });

  it("moves to the registered state with a matching status code once JsSIP registers", async () => {
    const { result } = await renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    act(() => {
      MockUA.instances[0].emit("registered");
    });

    await waitFor(() => {
      expect(result.current[0].connectionState).toBe("registered");
      expect(result.current[0].status).toEqual({ code: "registered" });
    });
  });

  it("surfaces registrationFailed as an error status carrying the SIP cause as detail", async () => {
    const { result } = await renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    act(() => {
      MockUA.instances[0].emit("registrationFailed", { cause: "Wrong password" });
    });

    await waitFor(() => {
      expect(result.current[0].connectionState).toBe("error");
      expect(result.current[0].status).toEqual({ code: "registrationFailed", detail: "Wrong password" });
    });
  });

  it("does not auto-retry after a registration failure, but retryConnection reconnects manually", async () => {
    const { result } = await renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    act(() => {
      MockUA.instances[0].emit("registrationFailed", { cause: "Wrong password" });
    });
    await waitFor(() => expect(result.current[0].connectionState).toBe("error"));

    expect(MockUA.instances).toHaveLength(1);

    act(() => {
      result.current[0].retryConnection();
    });

    await waitFor(() => expect(MockUA.instances).toHaveLength(2));
  });
});

describe("TURN REST credential refresh", () => {
  beforeEach(() => {
    MockUA.instances = [];
    getMock.mockReset();
    serveMe(webphoneMe);
  });

  it("schedules a refetch ahead of a minted TURN credential's expiry", async () => {
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    serveMe({
      ...webphoneMe,
      turnCredentials: { enabled: true, iceServers: [], expiresAt },
    });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    await renderPhone();

    await waitFor(() => {
      const scheduledNearExpiry = setTimeoutSpy.mock.calls.some(
        ([, delay]) => typeof delay === "number" && delay > 3.5 * 60_000 && delay < 4.5 * 60_000,
      );
      expect(scheduledNearExpiry).toBe(true);
    });

    setTimeoutSpy.mockRestore();
  });

  it("does not schedule a refetch when TURN REST credentials are disabled", async () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    await renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    const scheduledNearExpiry = setTimeoutSpy.mock.calls.some(
      ([, delay]) => typeof delay === "number" && delay > 3 * 60_000,
    );
    expect(scheduledNearExpiry).toBe(false);

    setTimeoutSpy.mockRestore();
  });
});

describe("formatWebphoneDuration / formatWebphoneLogTime", () => {
  it("formats seconds as zero-padded HH:MM:SS", async () => {
    const { formatWebphoneDuration } = await import("./useWebRTCPhone");
    expect(formatWebphoneDuration(0)).toBe("00:00:00");
    expect(formatWebphoneDuration(65)).toBe("00:01:05");
    expect(formatWebphoneDuration(3661)).toBe("01:01:01");
  });

  it("clamps negative durations to zero", async () => {
    const { formatWebphoneDuration } = await import("./useWebRTCPhone");
    expect(formatWebphoneDuration(-5)).toBe("00:00:00");
  });

  it("returns an empty string for missing or invalid log timestamps", async () => {
    const { formatWebphoneLogTime } = await import("./useWebRTCPhone");
    expect(formatWebphoneLogTime(undefined)).toBe("");
    expect(formatWebphoneLogTime(null)).toBe("");
    expect(formatWebphoneLogTime("not-a-date")).toBe("");
  });
});
