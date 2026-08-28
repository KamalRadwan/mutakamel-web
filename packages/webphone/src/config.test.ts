import { describe, expect, it } from "vitest";
import {
  endpointSocketWeight,
  iceServersFromSettings,
  isWebphoneReady,
  normalizeCallTarget,
  pcConfigFromSettings,
  sipUri,
} from "./config";
import type { WebphoneIceServer, WebphoneMe, WebphoneRuntimeConfig } from "./types";

function runtimeConfig(
  overrides: Partial<WebphoneRuntimeConfig> = {},
): WebphoneRuntimeConfig {
  return {
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
    ...overrides,
  };
}

function webphoneMe(overrides: Partial<WebphoneMe> = {}): WebphoneMe {
  return {
    enabled: true,
    extension: "100",
    sipUsername: "100",
    sipPassword: "secret",
    displayName: "Operator",
    outboundCallerId: null,
    transport: "wss",
    passwordConfigured: true,
    config: runtimeConfig(),
    turnCredentials: { enabled: false, iceServers: [], expiresAt: null },
    ...overrides,
  };
}

describe("endpointSocketWeight", () => {
  it("inverts priority so the lowest-priority endpoint gets the highest JsSIP weight", () => {
    expect(endpointSocketWeight(0)).toBeGreaterThan(endpointSocketWeight(1));
    expect(endpointSocketWeight(1)).toBeGreaterThan(endpointSocketWeight(10));
  });

  it("never produces a negative weight for an out-of-range priority", () => {
    expect(endpointSocketWeight(10_000)).toBe(0);
  });
});

describe("isWebphoneReady", () => {
  it("is ready when the extension and its runtime config are both complete", () => {
    expect(isWebphoneReady(webphoneMe({ passwordConfigured: false }))).toBe(true);
  });

  it("accepts passwordConfigured in place of a plaintext password", () => {
    expect(isWebphoneReady(webphoneMe({ sipPassword: null }))).toBe(true);
  });

  it("is not ready when the module is disabled server-side", () => {
    expect(isWebphoneReady(webphoneMe({ config: runtimeConfig({ enabled: false }) }))).toBe(false);
  });

  it("is not ready without a SIP username", () => {
    expect(isWebphoneReady(webphoneMe({ sipUsername: null }))).toBe(false);
  });

  it("is not ready without an enabled SIP endpoint to register against", () => {
    expect(isWebphoneReady(webphoneMe({ config: runtimeConfig({ endpoints: [] }) }))).toBe(false);
  });

  it("is not ready when the caller has no extension", () => {
    expect(isWebphoneReady(undefined)).toBe(false);
  });
});

describe("normalizeCallTarget / sipUri", () => {
  it("passes through an already-formed sip: URI", () => {
    expect(normalizeCallTarget("sip:100@other.example.com", "example.com")).toBe("sip:100@other.example.com");
  });

  it("qualifies a bare extension with the SIP domain", () => {
    expect(normalizeCallTarget("100", "example.com")).toBe("sip:100@example.com");
  });

  it("leaves an already-qualified user@host target alone besides the sip: prefix", () => {
    expect(normalizeCallTarget("100@other.example.com", "example.com")).toBe("sip:100@other.example.com");
  });

  it("builds a SIP AOR URI from a user and domain", () => {
    expect(sipUri("100", "example.com")).toBe("sip:100@example.com");
  });
});

describe("iceServersFromSettings", () => {
  it("maps the configured STUN/TURN entries in order", () => {
    const config = runtimeConfig({
      iceServers: [
        { urls: ["stun:stun.example.com"] },
        { urls: ["turn:turn.example.com"], username: "u", credential: "p" },
      ],
    });

    expect(iceServersFromSettings(config)).toEqual([
      { urls: ["stun:stun.example.com"], username: undefined, credential: undefined },
      { urls: ["turn:turn.example.com"], username: "u", credential: "p" },
    ]);
  });

  it("drops malformed entries instead of handing them to the browser", () => {
    const config = runtimeConfig({
      iceServers: [
        { urls: null } as unknown as WebphoneIceServer,
        { urls: [] },
        { urls: ["stun:stun.example.com"] },
      ],
    });

    expect(iceServersFromSettings(config)).toEqual([
      { urls: ["stun:stun.example.com"], username: undefined, credential: undefined },
    ]);
  });

  it("returns an empty array when there is no config", () => {
    expect(iceServersFromSettings(undefined)).toEqual([]);
  });
});

describe("pcConfigFromSettings", () => {
  it("sets iceTransportPolicy to 'relay' when configured", () => {
    const config = runtimeConfig({
      iceTransportPolicy: "relay",
      iceServers: [{ urls: ["turn:turn.example.com"], username: "u", credential: "p" }],
    });
    const pcConfig = pcConfigFromSettings(config);

    expect(pcConfig.iceTransportPolicy).toBe("relay");
    expect(pcConfig.iceServers).toContainEqual({
      urls: ["turn:turn.example.com"],
      username: "u",
      credential: "p",
    });
  });

  it("omits iceTransportPolicy (browser default) when set to 'all' or absent", () => {
    expect(pcConfigFromSettings(runtimeConfig()).iceTransportPolicy).toBeUndefined();
    expect(pcConfigFromSettings(undefined)).toEqual({ iceServers: [] });
  });

  it("appends ephemeral TURN REST ICE servers after the static config-derived ones", () => {
    const config = runtimeConfig({ iceServers: [{ urls: ["stun:a.example.com"] }] });
    const ephemeral = [{ urls: ["turn:turn.example.com:3478"], username: "123:admin-1", credential: "sig" }];

    expect(pcConfigFromSettings(config, ephemeral).iceServers).toEqual([
      { urls: ["stun:a.example.com"], username: undefined, credential: undefined },
      ...ephemeral,
    ]);
  });

  it("tolerates missing ephemeral ICE servers, falling back to the config-derived ones only", () => {
    const config = runtimeConfig({ iceServers: [{ urls: ["stun:a.example.com"] }] });

    expect(pcConfigFromSettings(config, undefined).iceServers).toEqual([
      { urls: ["stun:a.example.com"], username: undefined, credential: undefined },
    ]);
  });
});
