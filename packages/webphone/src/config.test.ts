import { describe, expect, it } from "vitest";
import {
  asteriskSettingsFromSystemSettings,
  iceServersFromSettings,
  isWebphoneReady,
  normalizeCallTarget,
  pcConfigFromSettings,
  sipUri,
} from "./config";
import type { ApiSystemSetting } from "./types";

function settingsFixture(overrides: Record<string, unknown> = {}): ApiSystemSetting[] {
  const base: Record<string, unknown> = {
    "asterisk.enabled": true,
    "asterisk.websocket_url": "wss://primary.example.com:8089/ws",
    "asterisk.sip_domain": "example.com",
    "asterisk.register_expires": "600",
    "asterisk.stun_servers": "stun:a.example.com,stun:b.example.com",
    "asterisk.turn_servers_json": "[]",
    "asterisk.ice_servers_json": "[]",
    "asterisk.extra_json": "{}",
    ...overrides,
  };
  return Object.entries(base).map(([key, value]) => ({ key, value }));
}

describe("asteriskSettingsFromSystemSettings", () => {
  it("parses the primary websocket URL and leaves the secondary undefined when unset", () => {
    const settings = asteriskSettingsFromSystemSettings(settingsFixture());
    expect(settings.websocketUrl).toBe("wss://primary.example.com:8089/ws");
    expect(settings.secondaryWebsocketUrl).toBeUndefined();
  });

  it("parses a configured secondary websocket URL for SIP failover", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.websocket_url_secondary": "wss://backup.example.com:8089/ws" }),
    );
    expect(settings.secondaryWebsocketUrl).toBe("wss://backup.example.com:8089/ws");
  });

  it("treats a blank secondary websocket URL as not configured", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.websocket_url_secondary": "   " }),
    );
    expect(settings.secondaryWebsocketUrl).toBeUndefined();
  });

  it("splits comma-separated STUN servers and trims whitespace", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.stun_servers": "stun:a.example.com , stun:b.example.com" }),
    );
    expect(settings.stunServers).toEqual(["stun:a.example.com", "stun:b.example.com"]);
  });

  it("falls back to an empty array for malformed ICE/TURN JSON", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.turn_servers_json": "{not valid json" }),
    );
    expect(settings.turnServers).toEqual([]);
  });
});

describe("isWebphoneReady", () => {
  const settings = asteriskSettingsFromSystemSettings(settingsFixture());

  it("is ready when settings and webphone credentials are both complete", () => {
    expect(
      isWebphoneReady(settings, { enabled: true, sipUsername: "100", sipPassword: "secret" }),
    ).toBe(true);
  });

  it("accepts passwordConfigured in place of a plaintext password", () => {
    expect(
      isWebphoneReady(settings, { enabled: true, sipUsername: "100", passwordConfigured: true }),
    ).toBe(true);
  });

  it("is not ready when Asterisk is disabled", () => {
    const disabled = asteriskSettingsFromSystemSettings(settingsFixture({ "asterisk.enabled": false }));
    expect(isWebphoneReady(disabled, { enabled: true, sipUsername: "100", sipPassword: "secret" })).toBe(false);
  });

  it("is not ready without a SIP username", () => {
    expect(isWebphoneReady(settings, { enabled: true, sipPassword: "secret" })).toBe(false);
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
  it("combines explicit ICE servers, STUN servers, and TURN servers", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({
        "asterisk.stun_servers": "stun:stun.example.com",
        "asterisk.turn_servers_json": JSON.stringify([{ urls: "turn:turn.example.com", username: "u", credential: "p" }]),
      }),
    );
    const servers = iceServersFromSettings(settings);
    expect(servers).toContainEqual({ urls: "stun:stun.example.com" });
    expect(servers).toContainEqual({ urls: "turn:turn.example.com", username: "u", credential: "p" });
  });

  it("returns an empty array when settings are undefined", () => {
    expect(iceServersFromSettings(undefined)).toEqual([]);
  });
});

describe("asterisk.ice_transport_policy parsing", () => {
  it("parses 'relay' into iceTransportPolicy", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.ice_transport_policy": "relay" }),
    );
    expect(settings.iceTransportPolicy).toBe("relay");
  });

  it("parses 'all' into iceTransportPolicy", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.ice_transport_policy": "all" }),
    );
    expect(settings.iceTransportPolicy).toBe("all");
  });

  it("ignores an unrecognized value rather than passing it through", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.ice_transport_policy": "bogus" }),
    );
    expect(settings.iceTransportPolicy).toBeUndefined();
  });

  it("is undefined when the key is absent", () => {
    const settings = asteriskSettingsFromSystemSettings(settingsFixture());
    expect(settings.iceTransportPolicy).toBeUndefined();
  });
});

describe("pcConfigFromSettings", () => {
  it("sets iceTransportPolicy to 'relay' when configured", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({
        "asterisk.ice_transport_policy": "relay",
        "asterisk.turn_servers_json": JSON.stringify([{ urls: "turn:turn.example.com", username: "u", credential: "p" }]),
      }),
    );
    const pcConfig = pcConfigFromSettings(settings);
    expect(pcConfig.iceTransportPolicy).toBe("relay");
    expect(pcConfig.iceServers).toContainEqual({ urls: "turn:turn.example.com", username: "u", credential: "p" });
  });

  it("omits iceTransportPolicy (browser default) when set to 'all' or unset", () => {
    const allSettings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.ice_transport_policy": "all" }),
    );
    expect(pcConfigFromSettings(allSettings).iceTransportPolicy).toBeUndefined();

    const unsetSettings = asteriskSettingsFromSystemSettings(settingsFixture());
    expect(pcConfigFromSettings(unsetSettings).iceTransportPolicy).toBeUndefined();
  });

  it("still includes ICE servers when settings are undefined", () => {
    expect(pcConfigFromSettings(undefined)).toEqual({ iceServers: [] });
  });

  it("appends ephemeral TURN REST ICE servers after the static settings-derived ones", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.stun_servers": "stun:a.example.com" }),
    );
    const ephemeral = [{ urls: ["turn:turn.example.com:3478"], username: "123:admin-1", credential: "sig" }];

    const pcConfig = pcConfigFromSettings(settings, ephemeral);

    expect(pcConfig.iceServers).toEqual([{ urls: "stun:a.example.com" }, ...ephemeral]);
  });

  it("tolerates missing ephemeral ICE servers, falling back to the settings-derived ones only", () => {
    const settings = asteriskSettingsFromSystemSettings(
      settingsFixture({ "asterisk.stun_servers": "stun:a.example.com" }),
    );
    expect(pcConfigFromSettings(settings, undefined).iceServers).toEqual([{ urls: "stun:a.example.com" }]);
  });
});
