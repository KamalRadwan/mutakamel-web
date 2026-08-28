// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminWebphoneConfig, AsteriskIntegrationSettings } from "@mutakamel/webphone";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

const { loadMyWebphoneConfigMock, loadAsteriskSettingsMock } = vi.hoisted(() => ({
  loadMyWebphoneConfigMock: vi.fn(),
  loadAsteriskSettingsMock: vi.fn(),
}));

vi.mock("../webphone/api", () => ({
  loadMyWebphoneConfig: loadMyWebphoneConfigMock,
  loadAsteriskSettings: loadAsteriskSettingsMock,
  loadMyWebphoneCallLogs: vi.fn().mockResolvedValue([]),
  createMyWebphoneCallLog: vi.fn().mockResolvedValue(undefined),
}));

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

const webphoneConfig: AdminWebphoneConfig = {
  enabled: true,
  extension: "100",
  sipUsername: "100",
  sipPassword: "secret",
  displayName: "Admin",
};

const asteriskSettings: AsteriskIntegrationSettings = {
  enabled: true,
  websocketUrl: "wss://primary.example.com:8089/ws",
  sipDomain: "example.com",
};

async function loadUseWebRTCPhone() {
  const mod = await import("./useWebRTCPhone");
  return mod.useWebRTCPhone;
}

describe("useWebRTCPhone connection lifecycle", () => {
  beforeEach(() => {
    MockUA.instances = [];
    loadMyWebphoneConfigMock.mockReset().mockResolvedValue(webphoneConfig);
    loadAsteriskSettingsMock.mockReset().mockResolvedValue(asteriskSettings);
  });

  it("registers with a single primary socket when no secondary is configured", async () => {
    const useWebRTCPhone = await loadUseWebRTCPhone();
    renderHook(() => useWebRTCPhone());

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    const sockets = MockUA.instances[0].config.sockets as Array<{ socket: MockWebSocketInterface; weight: number }>;
    expect(sockets).toHaveLength(1);
    expect(sockets[0].socket.url).toBe("wss://primary.example.com:8089/ws");
    expect(sockets[0].weight).toBe(10);
  });

  it("adds a lower-weight backup socket when a secondary websocket URL is configured", async () => {
    loadAsteriskSettingsMock.mockResolvedValue({
      ...asteriskSettings,
      secondaryWebsocketUrl: "wss://backup.example.com:8089/ws",
    });
    const useWebRTCPhone = await loadUseWebRTCPhone();
    renderHook(() => useWebRTCPhone());

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    const sockets = MockUA.instances[0].config.sockets as Array<{ socket: MockWebSocketInterface; weight: number }>;
    expect(sockets).toHaveLength(2);
    expect(sockets[0].socket.url).toBe("wss://primary.example.com:8089/ws");
    expect(sockets[0].weight).toBe(10);
    expect(sockets[1].socket.url).toBe("wss://backup.example.com:8089/ws");
    expect(sockets[1].weight).toBe(0);
  });

  it("moves to the registered state with a matching status code once JsSIP registers", async () => {
    const useWebRTCPhone = await loadUseWebRTCPhone();
    const { result } = renderHook(() => useWebRTCPhone());

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
    const useWebRTCPhone = await loadUseWebRTCPhone();
    const { result } = renderHook(() => useWebRTCPhone());

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
    const useWebRTCPhone = await loadUseWebRTCPhone();
    const { result } = renderHook(() => useWebRTCPhone());

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
    loadMyWebphoneConfigMock.mockReset().mockResolvedValue(webphoneConfig);
    loadAsteriskSettingsMock.mockReset().mockResolvedValue(asteriskSettings);
  });

  it("schedules a refetch ahead of a minted TURN credential's expiry", async () => {
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    loadMyWebphoneConfigMock.mockResolvedValue({
      ...webphoneConfig,
      turnCredentials: { enabled: true, iceServers: [], expiresAt },
    });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    const useWebRTCPhone = await loadUseWebRTCPhone();
    renderHook(() => useWebRTCPhone());

    await waitFor(() => {
      const scheduledNearExpiry = setTimeoutSpy.mock.calls.some(
        ([, delay]) => typeof delay === "number" && delay > 3.5 * 60_000 && delay < 4.5 * 60_000,
      );
      expect(scheduledNearExpiry).toBe(true);
    });

    setTimeoutSpy.mockRestore();
  });

  it("does not schedule a refetch when TURN REST credentials are disabled", async () => {
    loadMyWebphoneConfigMock.mockResolvedValue({
      ...webphoneConfig,
      turnCredentials: { enabled: false, iceServers: [], expiresAt: null },
    });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    const useWebRTCPhone = await loadUseWebRTCPhone();
    renderHook(() => useWebRTCPhone());

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
