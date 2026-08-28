import { describe, expect, it } from "vitest";
import {
  buildConfigPatch,
  configToForm,
  readWebphoneConfig,
  readWebphoneExtension,
  readWebphoneIceServer,
  readWebphoneSeats,
  validateConfigForm,
  validateEndpointDraft,
  validateExtensionDraft,
  validateIceServerDraft,
  EMPTY_ENDPOINT_DRAFT,
  EMPTY_EXTENSION_DRAFT,
  EMPTY_ICE_SERVER_DRAFT,
} from "./webphone-contract";

const CONFIG = {
  id: "0198c0de-0000-7000-8000-000000000001",
  tenantId: null,
  enabled: true,
  sipDomain: "sip.example.com",
  realm: "asterisk",
  outboundProxy: null,
  fromDomain: null,
  registrarServer: null,
  contactUri: null,
  registerExpires: 600,
  sessionTimers: false,
  traceSip: false,
  allowInvalidTlsCertificate: false,
  iceTransportPolicy: "all",
  defaultCallerId: null,
  turnRestEnabled: false,
  turnRestTtlSeconds: 3600,
  endpoints: [
    {
      id: "e2",
      label: "backup",
      websocketUrl: "wss://backup.example.com/ws",
      priority: 5,
      enabled: false,
    },
    {
      id: "e1",
      label: null,
      websocketUrl: "wss://primary.example.com/ws",
      priority: 0,
      enabled: true,
    },
  ],
  iceServers: [
    {
      id: "i2",
      kind: "TURN",
      urls: ["turn:turn.example.com:3478"],
      username: "turnuser",
      credentialConfigured: true,
      enabled: true,
      sortOrder: 3,
    },
    {
      id: "i1",
      kind: "STUN",
      urls: ["stun:stun.example.com:3478"],
      username: null,
      credentialConfigured: false,
      enabled: true,
      sortOrder: 0,
    },
  ],
};

describe("readWebphoneConfig", () => {
  it("orders endpoints by priority and ICE servers by sort order", () => {
    const config = readWebphoneConfig(CONFIG);
    expect(config.endpoints.map((entry) => entry.id)).toEqual(["e1", "e2"]);
    expect(config.iceServers.map((entry) => entry.id)).toEqual(["i1", "i2"]);
  });

  it("rejects a malformed configuration rather than rendering a partial one", () => {
    expect(() =>
      readWebphoneConfig({ ...CONFIG, iceTransportPolicy: "direct" }),
    ).toThrow(/INVALID_WEBPHONE_CONFIG_RESPONSE/);
  });
});

describe("write-only secrets", () => {
  it("refuses an ICE server response that carries a credential", () => {
    expect(() =>
      readWebphoneIceServer({
        ...CONFIG.iceServers[0],
        credential: "leaked-secret",
      }),
    ).toThrow(/INVALID_WEBPHONE_ICE_SERVER_RESPONSE/);
  });

  it("keeps only the configured flag for an ICE credential", () => {
    const server = readWebphoneIceServer(CONFIG.iceServers[0]);
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

describe("configuration form", () => {
  it("sends only changed fields, mapping a cleared optional to null", () => {
    const config = readWebphoneConfig(CONFIG);
    const form = configToForm(config);
    expect(buildConfigPatch(config, form)).toEqual({});

    expect(
      buildConfigPatch(config, { ...form, realm: "", registerExpires: "900" }),
    ).toEqual({ realm: null, registerExpires: 900 });
  });

  it("requires a SIP domain before the module can be enabled", () => {
    const form = configToForm(readWebphoneConfig(CONFIG));
    expect(validateConfigForm({ ...form, sipDomain: "" })).toMatchObject({
      sipDomain: "SIP_DOMAIN_REQUIRED",
    });
    expect(
      validateConfigForm({ ...form, enabled: false, sipDomain: "" }),
    ).toEqual({});
  });

  it("bounds the registration expiry and the TURN credential lifetime", () => {
    const form = configToForm(readWebphoneConfig(CONFIG));
    expect(validateConfigForm({ ...form, registerExpires: "29" })).toMatchObject(
      { registerExpires: "OUT_OF_RANGE" },
    );
    expect(
      validateConfigForm({ ...form, turnRestTtlSeconds: "59" }),
    ).toMatchObject({ turnRestTtlSeconds: "OUT_OF_RANGE" });
  });

  it("rejects a sip: URI that is not one", () => {
    const form = configToForm(readWebphoneConfig(CONFIG));
    expect(
      validateConfigForm({ ...form, outboundProxy: "https://proxy.example.com" }),
    ).toMatchObject({ outboundProxy: "INVALID_SIP_URI" });
  });
});

describe("draft validation", () => {
  it("requires a ws:// or wss:// endpoint URL", () => {
    expect(validateEndpointDraft(EMPTY_ENDPOINT_DRAFT)).toMatchObject({
      websocketUrl: "INVALID_WS_URL",
    });
    expect(
      validateEndpointDraft({
        ...EMPTY_ENDPOINT_DRAFT,
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

  it("rejects an extension number with letters in it", () => {
    expect(
      validateExtensionDraft({
        ...EMPTY_EXTENSION_DRAFT,
        ownerId: "u1",
        extension: "10a1",
        sipUsername: "user1001",
      }),
    ).toMatchObject({ extension: "INVALID_EXTENSION" });
  });
});
