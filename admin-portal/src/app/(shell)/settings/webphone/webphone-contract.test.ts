import { describe, expect, it } from "vitest";
import {
  buildServerPatch,
  extensionServersToRows,
  iceServerDraftToDto,
  moveInList,
  newServerDto,
  nextServerName,
  readWebphoneExtension,
  readWebphoneExtensionServers,
  readWebphoneIceServer,
  readWebphoneServer,
  readWebphoneServers,
  rowsToExtensionServers,
  serverToForm,
  validateExtensionServerRows,
  validateIceServerDraft,
  validateServerForm,
  websocketProtocol,
  withWebsocketProtocol,
  EMPTY_ICE_SERVER_DRAFT,
  NEW_SERVER_SIP_DOMAIN,
  NEW_SERVER_WEBSOCKET_URL,
} from "./webphone-contract";

const TURN_ICE = {
  id: "i1",
  kind: "TURN",
  urls: ["turn:turn.example.com:3478"],
  username: "turnuser",
  credentialConfigured: true,
  enabled: true,
  sortOrder: 0,
};

function server(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Primary",
    sipDomain: "sip.example.com",
    websocketUrl: "wss://primary.example.com/ws",
    priority: 0,
    enabled: true,
    realm: "asterisk",
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
    iceServers: [TURN_ICE],
    ...overrides,
  };
}

describe("readWebphoneServers", () => {
  it("orders servers lowest priority first, matching failover order", () => {
    const list = readWebphoneServers([
      server({ id: "s2", name: "Backup", priority: 5, iceServers: [] }),
      server({ id: "s1", priority: 0 }),
    ]);
    expect(list.map((entry) => entry.id)).toEqual(["s1", "s2"]);
  });

  it("sorts each server's ICE entries by their own sort order", () => {
    const parsed = readWebphoneServer(
      server({
        iceServers: [
          { ...TURN_ICE, id: "i2", sortOrder: 2 },
          { ...TURN_ICE, id: "i1", sortOrder: 1 },
        ],
      }),
    );
    expect(parsed.iceServers.map((ice) => ice.id)).toEqual(["i1", "i2"]);
  });

  it("rejects an unknown ICE transport policy", () => {
    expect(() =>
      readWebphoneServer(server({ iceTransportPolicy: "direct" })),
    ).toThrow(/INVALID_WEBPHONE_SERVER_RESPONSE/);
  });

  it("reads the ICE master switch, and refuses a response that omits it", () => {
    // Not defaulted to true when missing: a screen that silently assumed "on"
    // would render a parked server as if its ICE were live, which is the one
    // thing the switch exists to make visible.
    expect(readWebphoneServer(server({ iceEnabled: false })).iceEnabled).toBe(
      false,
    );
    expect(() =>
      readWebphoneServer(server({ iceEnabled: undefined })),
    ).toThrow(/INVALID_WEBPHONE_SERVER_RESPONSE/);
  });

  it("keeps every ICE entry of a parked server, exactly as stored", () => {
    // The admin surface returns them regardless of the switch, and this is
    // where they are switched back on from. Dropping or rewriting them here
    // would make the off state destructive in the one screen that can undo it.
    const parsed = readWebphoneServer(server({ iceEnabled: false }));

    expect(parsed.iceServers).toHaveLength(1);
    expect(parsed.iceServers[0]).toMatchObject({
      enabled: true,
      credentialConfigured: true,
    });
  });
});

describe("write-only secrets", () => {
  it("refuses an ICE server response carrying a credential", () => {
    expect(() =>
      readWebphoneIceServer({ ...TURN_ICE, credential: "leaked" }),
    ).toThrow(/INVALID_WEBPHONE_ICE_SERVER_RESPONSE/);
  });

  it("refuses an extension response carrying a SIP password", () => {
    expect(() =>
      readWebphoneExtension({
        id: "x1",
        ownerId: "u1",
        extension: "1001",
        sipUsername: "user1001",
        sipPassword: "leaked",
        passwordConfigured: true,
        displayName: null,
        outboundCallerId: null,
        enabled: true,
      }),
    ).toThrow(/INVALID_WEBPHONE_EXTENSION_RESPONSE/);
  });

  it("omits a blank TURN credential from the create payload", () => {
    // A blank field means "leave the stored credential alone", so the key must
    // not be sent at all — sending null would clear it.
    const dto = iceServerDraftToDto(
      {
        ...EMPTY_ICE_SERVER_DRAFT,
        kind: "TURN",
        urls: "turn:turn.example.com:3478",
        username: "someone",
      },
      0,
    );
    expect(dto).not.toHaveProperty("credential");
  });

  it("derives an added ICE entry's sort order from its position", () => {
    const dto = iceServerDraftToDto(
      { ...EMPTY_ICE_SERVER_DRAFT, urls: "stun:stun.example.com:3478" },
      3,
    );
    expect(dto.sortOrder).toBe(3);
  });
});

describe("adding a server", () => {
  it("numbers the name only once the plain one is taken", () => {
    const taken = [readWebphoneServer(server({ name: "New server" }))];
    expect(nextServerName([], "New server")).toBe("New server");
    expect(nextServerName(taken, "New server")).toBe("New server 2");
    expect(
      nextServerName(
        [...taken, readWebphoneServer(server({ id: "s2", name: "New server 2" }))],
        "New server",
      ),
    ).toBe("New server 3");
  });

  it("creates a server the API accepts and the operator must still finish", () => {
    const dto = newServerDto([], "New server");

    // Blank is not an option: both identity fields are required by the API, so
    // the placeholder has to satisfy the same rules the card enforces.
    expect(dto).toMatchObject({
      name: "New server",
      sipDomain: NEW_SERVER_SIP_DOMAIN,
      websocketUrl: NEW_SERVER_WEBSOCKET_URL,
    });
    const created = readWebphoneServer(server({ ...dto, iceServers: [] }));
    expect(validateServerForm(serverToForm(created))).toEqual({});
  });

  it("arrives disabled, so appending it cannot move live calls onto it", () => {
    expect(newServerDto([], "New server").enabled).toBe(false);
  });
});

describe("server form", () => {
  it("requires a name, a SIP domain and a ws/wss URL", () => {
    const form = serverToForm(readWebphoneServer(server()));
    expect(
      validateServerForm({ ...form, name: "", sipDomain: "", websocketUrl: "" }),
    ).toMatchObject({
      name: "NAME_REQUIRED",
      sipDomain: "SIP_DOMAIN_REQUIRED",
      websocketUrl: "INVALID_WS_URL",
    });
  });

  it("refuses relay-only transport with no enabled TURN entry", () => {
    const parsed = readWebphoneServer(server());
    const relay = { ...serverToForm(parsed), iceTransportPolicy: "relay" as const };

    expect(validateServerForm(relay, [])).toMatchObject({
      iceTransportPolicy: "RELAY_REQUIRES_TURN",
    });
    expect(
      validateServerForm(relay, [{ ...parsed.iceServers[0], enabled: false }]),
    ).toMatchObject({ iceTransportPolicy: "RELAY_REQUIRES_TURN" });
    // One enabled TURN entry is all the rule asks for.
    expect(validateServerForm(relay, parsed.iceServers)).not.toHaveProperty(
      "iceTransportPolicy",
    );
  });

  it("refuses relay-only transport while the ICE master switch is off", () => {
    // The TURN entries are present and enabled; the switch above them means
    // none of them reaches the browser, so relay-only has nothing to relay
    // through. Its own code, because the remedy is a different control.
    const parsed = readWebphoneServer(server());
    const relay = { ...serverToForm(parsed), iceTransportPolicy: "relay" as const };

    expect(validateServerForm(relay, parsed.iceServers, false)).toMatchObject({
      iceTransportPolicy: "RELAY_REQUIRES_ICE_ENABLED",
    });
    expect(
      validateServerForm(relay, parsed.iceServers, true),
    ).not.toHaveProperty("iceTransportPolicy");
  });

  it("leaves the default policy alone when ICE is parked", () => {
    // `all` still has host and server-reflexive candidates, so a parked ICE set
    // degrades NAT traversal rather than removing every media path. Refusing it
    // would block a legitimate diagnostic gesture.
    const parsed = readWebphoneServer(server());

    expect(
      validateServerForm(serverToForm(parsed), parsed.iceServers, false),
    ).toEqual({});
  });

  it("never carries the ICE master switch in a Save patch", () => {
    // It writes on change through its own switch. A Save that also carried it
    // would give one value two owners, which is how a toggle and a button come
    // to disagree.
    const parsed = readWebphoneServer(server({ iceEnabled: false }));
    const form = serverToForm(parsed);

    expect(
      buildServerPatch(parsed, { ...form, name: "Renamed" }),
    ).not.toHaveProperty("iceEnabled");
  });

  it("starts a new server with ICE switched on", () => {
    expect(newServerDto([], "New server").iceEnabled).toBe(true);
  });

  it("never patches priority, because order is written by the reorder route", () => {
    const parsed = readWebphoneServer(server());
    const form = serverToForm(parsed);
    expect(buildServerPatch(parsed, form)).toEqual({});
    const patch = buildServerPatch(parsed, { ...form, name: "Renamed", realm: "" });
    expect(patch).toEqual({ name: "Renamed", realm: null });
    expect(patch).not.toHaveProperty("priority");
  });
});

describe("websocket protocol", () => {
  it("reads the protocol from the URL scheme", () => {
    expect(websocketProtocol("ws://sip.example.com/ws")).toBe("ws");
    expect(websocketProtocol("wss://sip.example.com/ws")).toBe("wss");
  });

  it("rewrites only the scheme, keeping host, port and path", () => {
    expect(
      withWebsocketProtocol("wss://sip.example.com:8089/ws", "ws"),
    ).toBe("ws://sip.example.com:8089/ws");
    expect(withWebsocketProtocol("", "wss")).toBe("wss://");
  });
});

describe("extension server chain", () => {
  it("keeps a null override as inherit rather than turning it into zero", () => {
    const chain = readWebphoneExtensionServers([
      { serverId: "s2", priority: 1, timeoutSeconds: 20, maxRetries: null },
      { serverId: "s1", priority: 0, timeoutSeconds: null, maxRetries: 2 },
    ]);

    expect(chain.map((link) => link.serverId)).toEqual(["s1", "s2"]);
    expect(chain[0].timeoutSeconds).toBeNull();
    expect(extensionServersToRows(chain)[0].timeoutSeconds).toBe("");
  });

  it("writes position as priority and a blank override as null", () => {
    expect(
      rowsToExtensionServers([
        { serverId: "s2", timeoutSeconds: "", maxRetries: "3" },
        { serverId: "s1", timeoutSeconds: "20", maxRetries: "" },
      ]),
    ).toEqual([
      { serverId: "s2", priority: 0, timeoutSeconds: null, maxRetries: 3 },
      { serverId: "s1", priority: 1, timeoutSeconds: 20, maxRetries: null },
    ]);
  });

  it("bounds an override per row without rejecting a blank one", () => {
    expect(
      validateExtensionServerRows([
        { serverId: "s1", timeoutSeconds: "", maxRetries: "" },
        { serverId: "s2", timeoutSeconds: "9999", maxRetries: "99" },
      ]),
    ).toEqual({
      "s2.timeoutSeconds": "OUT_OF_RANGE",
      "s2.maxRetries": "OUT_OF_RANGE",
    });
  });
});

describe("reordering", () => {
  it("moves one entry without dropping or duplicating the rest", () => {
    expect(moveInList(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveInList(["a", "b", "c"], 0, 5)).toEqual(["a", "b", "c"]);
  });
});

describe("ICE draft validation", () => {
  it("rejects an ICE URL that is not a stun/turn URI", () => {
    expect(
      validateIceServerDraft({
        ...EMPTY_ICE_SERVER_DRAFT,
        urls: "https://stun.example.com",
      }),
    ).toMatchObject({ urls: "INVALID_ICE_URLS" });
  });

  it("counts a stored credential as the other half of the TURN pair", () => {
    const turn = {
      ...EMPTY_ICE_SERVER_DRAFT,
      kind: "TURN" as const,
      urls: "turn:turn.example.com:3478",
      username: "someone-else",
    };

    // A new entry really is missing its credential.
    expect(validateIceServerDraft(turn)).toMatchObject({
      credential: "TURN_CREDENTIAL_PAIR_REQUIRED",
    });
    // An existing one shows the field blank because the stored value is never
    // returned — reading that blank as "no credential" would make the username
    // of every configured TURN entry permanently uneditable.
    expect(validateIceServerDraft(turn, true)).not.toHaveProperty("credential");
    // Clearing the username while a credential stays stored still breaks the
    // pair, and still has to be refused.
    expect(
      validateIceServerDraft({ ...turn, username: "" }, true),
    ).toMatchObject({ credential: "TURN_CREDENTIAL_PAIR_REQUIRED" });
  });
});
