import { describe, expect, it } from "vitest";
import {
  iceServersFromSettings,
  isWebphoneReady,
  normalizeCallTarget,
  pcConfigFromSettings,
  sipUri,
  usableWebphoneServers,
} from "./config";
import type { WebphoneIceServer, WebphoneMe, WebphoneServer } from "./types";

function webphoneServer(overrides: Partial<WebphoneServer> = {}): WebphoneServer {
  return {
    id: "server-1",
    name: "Primary",
    priority: 1,
    sipDomain: "example.com",
    websocketUrl: "wss://primary.example.com:8089/ws",
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 600,
    defaultCallerId: null,
    iceTransportPolicy: "all",
    traceSip: false,
    sessionTimers: false,
    allowInvalidTlsCertificate: false,
    timeoutSeconds: 10,
    maxRetries: 2,
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
    passwordConfigured: true,
    servers: [webphoneServer()],
    turnCredentials: { enabled: false, iceServers: [], expiresAt: null },
    ...overrides,
  };
}

describe("usableWebphoneServers", () => {
  it("drops servers that could never be dialled, keeping the API's priority order", () => {
    const servers = usableWebphoneServers(
      webphoneMe({
        servers: [
          webphoneServer({ id: "a", name: "A", websocketUrl: "" }),
          webphoneServer({ id: "b", name: "B" }),
          webphoneServer({ id: "c", name: "C", sipDomain: "" }),
          webphoneServer({ id: "d", name: "D" }),
        ],
      }),
    );

    expect(servers.map((server) => server.id)).toEqual(["b", "d"]);
  });

  it("returns an empty list when there is no phone at all", () => {
    expect(usableWebphoneServers(undefined)).toEqual([]);
  });
});

describe("isWebphoneReady", () => {
  it("is ready when the extension is enabled and one server can be registered against", () => {
    expect(isWebphoneReady(webphoneMe({ passwordConfigured: false }))).toBe(true);
  });

  it("accepts passwordConfigured in place of a plaintext password", () => {
    expect(isWebphoneReady(webphoneMe({ sipPassword: null }))).toBe(true);
  });

  it("is not ready when the extension is disabled server-side", () => {
    expect(isWebphoneReady(webphoneMe({ enabled: false }))).toBe(false);
  });

  it("is not ready without a SIP username", () => {
    expect(isWebphoneReady(webphoneMe({ sipUsername: null }))).toBe(false);
  });

  it("is not ready without a server to register against", () => {
    expect(isWebphoneReady(webphoneMe({ servers: [] }))).toBe(false);
  });

  it("is not ready when every server is missing its domain or socket URL", () => {
    expect(
      isWebphoneReady(
        webphoneMe({
          servers: [webphoneServer({ sipDomain: "" }), webphoneServer({ websocketUrl: "" })],
        }),
      ),
    ).toBe(false);
  });

  it("is ready as long as one server in the list is complete", () => {
    expect(
      isWebphoneReady(
        webphoneMe({ servers: [webphoneServer({ websocketUrl: "" }), webphoneServer()] }),
      ),
    ).toBe(true);
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
  it("maps the current server's STUN/TURN entries in order", () => {
    const server = webphoneServer({
      iceServers: [
        { kind: "stun", urls: ["stun:stun.example.com"] },
        { kind: "turn", urls: ["turn:turn.example.com"], username: "u", credential: "p" },
      ],
    });

    expect(iceServersFromSettings(server)).toEqual([
      { urls: ["stun:stun.example.com"], username: undefined, credential: undefined },
      { urls: ["turn:turn.example.com"], username: "u", credential: "p" },
    ]);
  });

  it("drops malformed entries instead of handing them to the browser", () => {
    const server = webphoneServer({
      iceServers: [
        { kind: "stun", urls: null } as unknown as WebphoneIceServer,
        { kind: "stun", urls: [] },
        { kind: "stun", urls: ["stun:stun.example.com"] },
      ],
    });

    expect(iceServersFromSettings(server)).toEqual([
      { urls: ["stun:stun.example.com"], username: undefined, credential: undefined },
    ]);
  });

  it("returns an empty array when there is no server", () => {
    expect(iceServersFromSettings(undefined)).toEqual([]);
  });
});

describe("pcConfigFromSettings", () => {
  it("sets iceTransportPolicy to 'relay' when the current server asks for it", () => {
    const server = webphoneServer({
      iceTransportPolicy: "relay",
      iceServers: [{ kind: "turn", urls: ["turn:turn.example.com"], username: "u", credential: "p" }],
    });
    const pcConfig = pcConfigFromSettings(server);

    expect(pcConfig.iceTransportPolicy).toBe("relay");
    expect(pcConfig.iceServers).toContainEqual({
      urls: ["turn:turn.example.com"],
      username: "u",
      credential: "p",
    });
  });

  it("omits iceTransportPolicy (browser default) when set to 'all' or absent", () => {
    expect(pcConfigFromSettings(webphoneServer()).iceTransportPolicy).toBeUndefined();
    expect(pcConfigFromSettings(undefined)).toEqual({ iceServers: [] });
  });

  it("takes the media policy from the server in hand, not from a scope-wide default", () => {
    // Failover routinely mixes a direct-media primary with a relay-only
    // fallback, so the policy has to follow whichever one the phone is on.
    const primary = webphoneServer({ iceServers: [{ kind: "stun", urls: ["stun:a.example.com"] }] });
    const fallback = webphoneServer({
      id: "server-2",
      iceTransportPolicy: "relay",
      iceServers: [{ kind: "turn", urls: ["turn:b.example.com"], username: "u", credential: "p" }],
    });

    expect(pcConfigFromSettings(primary)).toEqual({
      iceServers: [{ urls: ["stun:a.example.com"], username: undefined, credential: undefined }],
    });
    expect(pcConfigFromSettings(fallback)).toEqual({
      iceServers: [{ urls: ["turn:b.example.com"], username: "u", credential: "p" }],
      iceTransportPolicy: "relay",
    });
  });

  it("appends ephemeral TURN REST ICE servers after the server's own ones", () => {
    const server = webphoneServer({ iceServers: [{ kind: "stun", urls: ["stun:a.example.com"] }] });
    const ephemeral = [{ urls: ["turn:turn.example.com:3478"], username: "123:admin-1", credential: "sig" }];

    expect(pcConfigFromSettings(server, ephemeral).iceServers).toEqual([
      { urls: ["stun:a.example.com"], username: undefined, credential: undefined },
      ...ephemeral,
    ]);
  });

  it("tolerates missing ephemeral ICE servers, falling back to the server's own ones", () => {
    const server = webphoneServer({ iceServers: [{ kind: "stun", urls: ["stun:a.example.com"] }] });

    expect(pcConfigFromSettings(server, undefined).iceServers).toEqual([
      { urls: ["stun:a.example.com"], username: undefined, credential: undefined },
    ]);
  });
});
