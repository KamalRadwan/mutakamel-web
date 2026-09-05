import { describe, expect, it } from "vitest";
import {
  buildServerPatch,
  moveServerId,
  readWebphoneConfig,
  readWebphoneExtension,
  readWebphoneIceServer,
  readWebphoneSeats,
  readWebphoneServer,
  readWebphoneServers,
  serverToForm,
  validateExtensionDraft,
  validateIceServerDraft,
  validateServerDraft,
  validateServerForm,
  websocketProtocol,
  withWebsocketProtocol,
  EMPTY_EXTENSION_DRAFT,
  EMPTY_ICE_SERVER_DRAFT,
  EMPTY_SERVER_DRAFT,
} from "./webphone-contract";

/** The whole of `GET /config`: a tenant id this screen ignores, and a derived flag. */
const CONFIG = {
  tenantId: "0198c0de-0000-7000-8000-0000000000t1",
  enabled: true,
};

const TURN_ENTRY = {
  id: "i2",
  kind: "TURN",
  urls: ["turn:turn.example.com:3478"],
  username: "turnuser",
  credentialConfigured: true,
  enabled: true,
  sortOrder: 3,
};

const STUN_ENTRY = {
  id: "i1",
  kind: "STUN",
  urls: ["stun:stun.example.com:3478"],
  username: null,
  credentialConfigured: false,
  enabled: true,
  sortOrder: 0,
};

const PRIMARY_SERVER = {
  id: "s1",
  name: "Cairo primary",
  sipDomain: "sip.example.com",
  websocketUrl: "wss://primary.example.com/ws",
  priority: 1,
  enabled: true,
  realm: "asterisk",
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
  defaultTimeoutSeconds: 10,
  defaultMaxRetries: 2,
  iceServers: [TURN_ENTRY, STUN_ENTRY],
};

const BACKUP_SERVER = {
  ...PRIMARY_SERVER,
  id: "s2",
  name: "Cairo backup",
  websocketUrl: "ws://backup.example.com/ws",
  priority: 2,
  enabled: false,
  iceServers: [],
};

describe("readWebphoneConfig", () => {
  it("reads the one derived flag and ignores the tenant id beside it", () => {
    // The scope keeps no settings of its own: no SIP field, no stored switch,
    // and no TURN REST minting controls. Anything else in the payload is not
    // this screen's to render.
    expect(readWebphoneConfig(CONFIG)).toEqual({ enabled: true });
  });

  it("rejects a malformed configuration rather than rendering a partial one", () => {
    expect(() => readWebphoneConfig({ ...CONFIG, enabled: "yes" })).toThrow(
      /INVALID_WEBPHONE_CONFIG_RESPONSE/,
    );
    expect(() => readWebphoneConfig({ tenantId: "t1" })).toThrow(
      /INVALID_WEBPHONE_CONFIG_RESPONSE/,
    );
  });
});

describe("readWebphoneServers", () => {
  it("orders servers by priority and each server's ICE entries by sort order", () => {
    const servers = readWebphoneServers([BACKUP_SERVER, PRIMARY_SERVER]);
    expect(servers.map((entry) => entry.id)).toEqual(["s1", "s2"]);
    expect(servers[0].iceServers.map((entry) => entry.id)).toEqual(["i1", "i2"]);
  });

  it("accepts the paginated envelope as well as a bare array", () => {
    expect(
      readWebphoneServers({ items: [PRIMARY_SERVER] }).map((entry) => entry.id),
    ).toEqual(["s1"]);
  });

  it("rejects a malformed server rather than rendering a partial one", () => {
    expect(() =>
      readWebphoneServer({ ...PRIMARY_SERVER, iceTransportPolicy: "direct" }),
    ).toThrow(/INVALID_WEBPHONE_SERVER_RESPONSE/);
  });

  it("rejects a priority outside the contiguous-from-one range", () => {
    // Zero was a legal endpoint priority and is not a legal server position;
    // a response carrying one is a server the badge could not number.
    expect(() => readWebphoneServer({ ...PRIMARY_SERVER, priority: 0 })).toThrow(
      /INVALID_WEBPHONE_SERVER_RESPONSE/,
    );
  });

  it("rejects failover defaults outside the range the server enforces", () => {
    expect(() =>
      readWebphoneServer({ ...PRIMARY_SERVER, defaultTimeoutSeconds: 1 }),
    ).toThrow(/INVALID_WEBPHONE_SERVER_RESPONSE/);
    expect(() =>
      readWebphoneServer({ ...PRIMARY_SERVER, defaultMaxRetries: 11 }),
    ).toThrow(/INVALID_WEBPHONE_SERVER_RESPONSE/);
  });
});

describe("write-only secrets", () => {
  it("refuses an ICE server response that carries a credential", () => {
    expect(() =>
      readWebphoneIceServer({ ...TURN_ENTRY, credential: "leaked-secret" }),
    ).toThrow(/INVALID_WEBPHONE_ICE_SERVER_RESPONSE/);
  });

  it("refuses a server whose nested ICE entry carries a credential", () => {
    expect(() =>
      readWebphoneServer({
        ...PRIMARY_SERVER,
        iceServers: [{ ...TURN_ENTRY, credential: "leaked-secret" }],
      }),
    ).toThrow(/INVALID_WEBPHONE_ICE_SERVER_RESPONSE/);
  });

  it("keeps only the configured flag for an ICE credential", () => {
    const server = readWebphoneIceServer(TURN_ENTRY);
    expect(server.credentialConfigured).toBe(true);
    expect(Object.keys(server)).not.toContain("credential");
  });

  it("refuses an extension response that carries a SIP password", () => {
    expect(() =>
      readWebphoneExtension({
        id: "x1",
        ownerId: "u1",
        extension: "1001",
        sipUsername: "user1001",
        sipPassword: "leaked-secret",
        passwordConfigured: true,
        displayName: null,
        outboundCallerId: null,
        transport: "wss",
        enabled: true,
      }),
    ).toThrow(/INVALID_WEBPHONE_EXTENSION_RESPONSE/);
  });
});

describe("readWebphoneSeats", () => {
  it("reports availability when occupancy is within the allowance", () => {
    expect(
      readWebphoneSeats({
        allowed: 10,
        occupied: 4,
        available: 6,
        overAllowance: false,
      }),
    ).toEqual({ allowed: 10, occupied: 4, available: 6, overAllowance: false });
  });

  it("reports over-allowance instead of a negative availability", () => {
    // Reducing seats never auto-disables a working phone, so occupancy above
    // the allowance is a state the UI has to be able to say out loud.
    expect(
      readWebphoneSeats({
        allowed: 3,
        occupied: 5,
        available: 0,
        overAllowance: true,
      }),
    ).toEqual({ allowed: 3, occupied: 5, available: 0, overAllowance: true });
  });

  it("derives availability rather than trusting a negative one", () => {
    expect(
      readWebphoneSeats({
        allowed: 3,
        occupied: 5,
        available: -2,
        overAllowance: false,
      }),
    ).toEqual({ allowed: 3, occupied: 5, available: 0, overAllowance: true });
  });

  it("rejects non-integer seat counts", () => {
    expect(() =>
      readWebphoneSeats({ allowed: "10", occupied: 1 }),
    ).toThrow(/INVALID_WEBPHONE_SEATS_RESPONSE/);
  });
});

describe("server form", () => {
  const server = readWebphoneServer(PRIMARY_SERVER);
  const form = serverToForm(server);

  it("sends only changed fields, mapping a cleared optional to null", () => {
    expect(buildServerPatch(server, form)).toEqual({});
    expect(
      buildServerPatch(server, { ...form, realm: "", registerExpires: "900" }),
    ).toEqual({ realm: null, registerExpires: 900 });
  });

  it("never offers priority as an edit", () => {
    // Position is renumbered wholesale by the reorder endpoint, so it is not
    // on the form and cannot reach a patch from here.
    expect(Object.keys(form)).not.toContain("priority");
    expect(
      buildServerPatch(server, { ...form, name: "Renamed" }),
    ).not.toHaveProperty("priority");
  });

  it("requires a name, a SIP domain and a WebSocket URL", () => {
    expect(validateServerForm({ ...form, name: "" }, [])).toMatchObject({
      name: "INVALID_SERVER_NAME",
    });
    expect(validateServerForm({ ...form, sipDomain: "" }, [])).toMatchObject({
      sipDomain: "INVALID_SIP_DOMAIN",
    });
    expect(
      validateServerForm({ ...form, websocketUrl: "https://sip.example.com" }, []),
    ).toMatchObject({ websocketUrl: "INVALID_WS_URL" });
  });

  it("bounds the registration expiry and the failover defaults", () => {
    expect(
      validateServerForm({ ...form, registerExpires: "29" }, []),
    ).toMatchObject({ registerExpires: "OUT_OF_RANGE" });
    expect(
      validateServerForm({ ...form, defaultTimeoutSeconds: "121" }, []),
    ).toMatchObject({ defaultTimeoutSeconds: "OUT_OF_RANGE" });
    expect(
      validateServerForm({ ...form, defaultMaxRetries: "11" }, []),
    ).toMatchObject({ defaultMaxRetries: "OUT_OF_RANGE" });
  });

  it("rejects a sip: URI that is not one", () => {
    expect(
      validateServerForm(
        { ...form, outboundProxy: "https://proxy.example.com" },
        [],
      ),
    ).toMatchObject({ outboundProxy: "INVALID_SIP_URI" });
  });

  it("refuses relay-only transport unless this server has an enabled TURN entry", () => {
    // Relay-only with nothing to relay through leaves every call on this
    // server without a media path, so the save is refused before it is sent.
    const relay = { ...form, iceTransportPolicy: "relay" as const };
    expect(validateServerForm(relay, [])).toMatchObject({
      iceTransportPolicy: "RELAY_REQUIRES_TURN",
    });
    expect(
      validateServerForm(relay, [readWebphoneIceServer(STUN_ENTRY)]),
    ).toMatchObject({ iceTransportPolicy: "RELAY_REQUIRES_TURN" });
    expect(
      validateServerForm(relay, [
        readWebphoneIceServer({ ...TURN_ENTRY, enabled: false }),
      ]),
    ).toMatchObject({ iceTransportPolicy: "RELAY_REQUIRES_TURN" });
    expect(
      validateServerForm(relay, [readWebphoneIceServer(TURN_ENTRY)]),
    ).toEqual({});
  });

  it("applies the rule per server, not across the whole scope", () => {
    const relay = { ...form, iceTransportPolicy: "relay" as const };
    const backup = readWebphoneServer(BACKUP_SERVER);
    // The primary's TURN entry is no help to a server in another network.
    expect(validateServerForm(relay, backup.iceServers)).toMatchObject({
      iceTransportPolicy: "RELAY_REQUIRES_TURN",
    });
  });
});

describe("the WebSocket URL carries the protocol", () => {
  it("reads the transport out of the scheme", () => {
    expect(websocketProtocol("wss://sip.example.com/ws")).toBe("wss");
    expect(websocketProtocol("ws://sip.example.com/ws")).toBe("ws");
    // A half-typed URL sits on the secure default rather than reporting `ws`.
    expect(websocketProtocol("sip.example.com")).toBe("wss");
  });

  it("rewrites the scheme in place instead of storing a second copy", () => {
    expect(withWebsocketProtocol("wss://sip.example.com/ws", "ws")).toBe(
      "ws://sip.example.com/ws",
    );
    expect(withWebsocketProtocol("ws://sip.example.com/ws", "wss")).toBe(
      "wss://sip.example.com/ws",
    );
    expect(withWebsocketProtocol("sip.example.com/ws", "wss")).toBe(
      "wss://sip.example.com/ws",
    );
  });

  it("keeps a rewritten URL valid", () => {
    const form = serverToForm(readWebphoneServer(PRIMARY_SERVER));
    expect(
      validateServerForm(
        {
          ...form,
          websocketUrl: withWebsocketProtocol(form.websocketUrl, "ws"),
        },
        [],
      ),
    ).toEqual({});
  });
});

describe("moveServerId", () => {
  it("returns the full list in the new order", () => {
    expect(moveServerId(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveServerId(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("never loses an id to an out-of-range or no-op move", () => {
    expect(moveServerId(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
    expect(moveServerId(["a", "b", "c"], 0, 9)).toEqual(["a", "b", "c"]);
    expect(moveServerId(["a", "b", "c"], -1, 0)).toEqual(["a", "b", "c"]);
  });
});

describe("draft validation", () => {
  it("requires a name, domain and ws:// or wss:// URL on a new server", () => {
    expect(validateServerDraft(EMPTY_SERVER_DRAFT)).toMatchObject({
      name: "INVALID_SERVER_NAME",
      sipDomain: "INVALID_SIP_DOMAIN",
      websocketUrl: "INVALID_WS_URL",
    });
    expect(
      validateServerDraft({
        ...EMPTY_SERVER_DRAFT,
        name: "Cairo primary",
        sipDomain: "sip.example.com",
        websocketUrl: "wss://sip.example.com:8089/ws",
      }),
    ).toEqual({});
  });

  it("keeps STUN entries free of credentials and pairs TURN ones", () => {
    expect(
      validateIceServerDraft({
        ...EMPTY_ICE_SERVER_DRAFT,
        urls: "stun:stun.example.com:3478",
        username: "someone",
      }),
    ).toMatchObject({ username: "STUN_HAS_NO_CREDENTIALS" });

    expect(
      validateIceServerDraft({
        ...EMPTY_ICE_SERVER_DRAFT,
        kind: "TURN",
        urls: "turn:turn.example.com:3478",
        username: "someone",
      }),
    ).toMatchObject({ credential: "TURN_CREDENTIAL_PAIR_REQUIRED" });

    expect(
      validateIceServerDraft({
        ...EMPTY_ICE_SERVER_DRAFT,
        kind: "TURN",
        urls: "turn:turn.example.com:3478",
        username: "someone",
        credential: "secret",
      }),
    ).toEqual({});
  });

  it("requires a SIP password before an extension can be created enabled", () => {
    const draft = {
      ...EMPTY_EXTENSION_DRAFT,
      ownerId: "0198c0de-0000-7000-8000-0000000000aa",
      extension: "1001",
      sipUsername: "user1001",
      enabled: true,
    };
    expect(validateExtensionDraft(draft)).toMatchObject({
      sipPassword: "PASSWORD_REQUIRED_TO_ENABLE",
    });
    expect(
      validateExtensionDraft({ ...draft, sipPassword: "s3cret" }),
    ).toEqual({});
  });

  // Letters are legitimate: a dial plan addresses queues and departments by
  // name as often as by number, so `SQ_1023` is an ordinary extension.
  it("accepts an alphanumeric extension", () => {
    expect(
      validateExtensionDraft({
        ...EMPTY_EXTENSION_DRAFT,
        ownerId: "u1",
        extension: "SQ_1023",
        sipUsername: "user1001",
      }),
    ).not.toMatchObject({ extension: "INVALID_EXTENSION" });
  });

  it("still rejects an extension carrying characters a SIP URI would have to escape", () => {
    expect(
      validateExtensionDraft({
        ...EMPTY_EXTENSION_DRAFT,
        ownerId: "u1",
        extension: "10 1@x",
        sipUsername: "user1001",
      }),
    ).toMatchObject({ extension: "INVALID_EXTENSION" });
  });
});
