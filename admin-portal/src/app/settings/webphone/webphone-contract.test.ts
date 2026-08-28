import { describe, expect, it } from "vitest";
import {
  buildConfigPatch,
  configToForm,
  endpointDraftToDto,
  iceServerDraftToDto,
  readWebphoneConfig,
  readWebphoneExtension,
  readWebphoneFleetSeats,
  readWebphoneIceServer,
  readWebphoneSeats,
  validateConfigForm,
  validateEndpointDraft,
  validateIceServerDraft,
  EMPTY_ENDPOINT_DRAFT,
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
      id: "i1",
      kind: "TURN",
      urls: ["turn:turn.example.com:3478"],
      username: "turnuser",
      credentialConfigured: true,
      enabled: true,
      sortOrder: 0,
    },
  ],
};

describe("readWebphoneConfig", () => {
  it("orders endpoints lowest priority first, matching failover order", () => {
    expect(readWebphoneConfig(CONFIG).endpoints.map((e) => e.id)).toEqual([
      "e1",
      "e2",
    ]);
  });

  it("rejects an unknown ICE transport policy", () => {
    expect(() =>
      readWebphoneConfig({ ...CONFIG, iceTransportPolicy: "direct" }),
    ).toThrow(/INVALID_WEBPHONE_CONFIG_RESPONSE/);
  });
});

describe("write-only secrets", () => {
  it("refuses an ICE server response carrying a credential", () => {
    expect(() =>
      readWebphoneIceServer({ ...CONFIG.iceServers[0], credential: "leaked" }),
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
        transport: "wss",
        enabled: true,
      }),
    ).toThrow(/INVALID_WEBPHONE_EXTENSION_RESPONSE/);
  });

  it("omits a blank TURN credential from the create payload", () => {
    // A blank field means "leave the stored credential alone", so the key must
    // not be sent at all — sending null would clear it.
    const dto = iceServerDraftToDto({
      ...EMPTY_ICE_SERVER_DRAFT,
      kind: "TURN",
      urls: "turn:turn.example.com:3478",
      username: "someone",
    });
    expect(dto).not.toHaveProperty("credential");
  });
});

describe("seat accounting", () => {
  it("clamps availability and reports over-allowance honestly", () => {
    expect(
      readWebphoneSeats({
        allowed: 3,
        occupied: 5,
        available: -2,
        overAllowance: false,
      }),
    ).toEqual({ allowed: 3, occupied: 5, available: 0, overAllowance: true });
  });

  it("reads fleet rows and falls back to the tenant id for a missing name", () => {
    const rows = readWebphoneFleetSeats([
      {
        tenantId: "0198c0de-0000-7000-8000-0000000000aa",
        tenantName: "Acme",
        allowed: 5,
        occupied: 2,
        available: 3,
        overAllowance: false,
      },
      {
        tenantId: "0198c0de-0000-7000-8000-0000000000bb",
        allowed: 1,
        occupied: 4,
        available: 0,
        overAllowance: true,
      },
    ]);

    expect(rows[0].tenantName).toBe("Acme");
    expect(rows[1].tenantName).toBe("0198c0de-0000-7000-8000-0000000000bb");
    expect(rows[1]).toMatchObject({ available: 0, overAllowance: true });
  });
});

describe("configuration form", () => {
  it("sends only what changed and clears an emptied optional to null", () => {
    const config = readWebphoneConfig(CONFIG);
    const form = configToForm(config);
    expect(buildConfigPatch(config, form)).toEqual({});
    expect(
      buildConfigPatch(config, { ...form, realm: "", turnRestEnabled: true }),
    ).toEqual({ realm: null, turnRestEnabled: true });
  });

  it("requires a SIP domain before enabling", () => {
    const form = configToForm(readWebphoneConfig(CONFIG));
    expect(validateConfigForm({ ...form, sipDomain: "" })).toMatchObject({
      sipDomain: "SIP_DOMAIN_REQUIRED",
    });
  });
});

describe("draft validation", () => {
  it("requires a ws:// or wss:// endpoint URL and bounds its priority", () => {
    expect(validateEndpointDraft(EMPTY_ENDPOINT_DRAFT)).toMatchObject({
      websocketUrl: "INVALID_WS_URL",
    });
    expect(
      validateEndpointDraft({
        ...EMPTY_ENDPOINT_DRAFT,
        websocketUrl: "wss://sip.example.com/ws",
        priority: "101",
      }),
    ).toMatchObject({ priority: "OUT_OF_RANGE" });
  });

  it("drops an empty endpoint label instead of sending an empty string", () => {
    expect(
      endpointDraftToDto({
        ...EMPTY_ENDPOINT_DRAFT,
        websocketUrl: "wss://sip.example.com/ws",
      }),
    ).not.toHaveProperty("label");
  });

  it("rejects an ICE URL that is not a stun/turn URI", () => {
    expect(
      validateIceServerDraft({
        ...EMPTY_ICE_SERVER_DRAFT,
        urls: "https://stun.example.com",
      }),
    ).toMatchObject({ urls: "INVALID_ICE_URLS" });
  });
});
