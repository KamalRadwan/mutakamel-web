import type {
  ApiSystemSetting,
  AsteriskIntegrationSettings,
  AdminWebphoneConfig,
} from "./types";

export function asteriskSettingsFromSystemSettings(
  settings: ApiSystemSetting[],
): AsteriskIntegrationSettings {
  const values = new Map(
    settings.map((setting) => [setting.key, setting.value]),
  );

  return {
    enabled: booleanValue(values.get("asterisk.enabled")),
    websocketUrl: stringValue(values.get("asterisk.websocket_url")),
    secondaryWebsocketUrl: optionalString(
      values.get("asterisk.websocket_url_secondary"),
    ),
    sipDomain: stringValue(values.get("asterisk.sip_domain")),
    realm: stringValue(values.get("asterisk.realm")),
    outboundProxy: stringValue(values.get("asterisk.outbound_proxy")),
    defaultCallerId: stringValue(values.get("asterisk.default_caller_id")),
    fromDomain: stringValue(values.get("asterisk.from_domain")),
    registrarServer: stringValue(values.get("asterisk.registrar_server")),
    contactUri: stringValue(values.get("asterisk.contact_uri")),
    registerExpires: numberValue(values.get("asterisk.register_expires")),
    sessionTimers: booleanValue(values.get("asterisk.session_timers")),
    traceSip: booleanValue(values.get("asterisk.trace_sip")),
    allowInvalidTlsCertificate: booleanValue(
      values.get("asterisk.allow_invalid_tls_certificate"),
    ),
    stunServers: commaSeparatedValue(
      values.get("asterisk.stun_servers"),
    ),
    turnServers: jsonObjectArray(
      values.get("asterisk.turn_servers_json"),
    ),
    iceServers: jsonObjectArray(values.get("asterisk.ice_servers_json")),
    iceTransportPolicy: iceTransportPolicyValue(
      values.get("asterisk.ice_transport_policy"),
    ),
    extra: jsonObject(values.get("asterisk.extra_json")),
  };
}

export function isWebphoneReady(
  settings?: AsteriskIntegrationSettings,
  webphone?: AdminWebphoneConfig | null,
) {
  return Boolean(
    settings?.enabled &&
      settings.websocketUrl &&
      settings.sipDomain &&
      webphone?.enabled &&
      webphone.sipUsername &&
      (webphone.sipPassword || webphone.passwordConfigured),
  );
}

export function normalizeCallTarget(target: string, sipDomain: string) {
  const value = target.trim();
  if (/^sip:/i.test(value)) return value;
  if (value.includes("@")) return `sip:${value}`;
  return `sip:${value}@${sipDomain}`;
}

export function sipUri(user: string, domain: string) {
  return `sip:${user}@${domain}`;
}

export function iceServersFromSettings(
  settings?: AsteriskIntegrationSettings,
): RTCIceServer[] {
  const explicit = (settings?.iceServers ?? [])
    .map(toIceServer)
    .filter((server): server is RTCIceServer => Boolean(server));
  const stun = (settings?.stunServers ?? []).map((url) => ({ urls: url }));
  const turn = (settings?.turnServers ?? [])
    .map(toIceServer)
    .filter((server): server is RTCIceServer => Boolean(server));

  return [...explicit, ...stun, ...turn];
}

/**
 * Builds the RTCPeerConnection config for a call. `ephemeralIceServers`
 * (from minted TURN REST credentials, see `AdminWebphoneConfig.turnCredentials`)
 * are appended after the static settings-derived ones. Only sets
 * `iceTransportPolicy` when it's 'relay' — omitting it otherwise matches
 * the browser default ('all') rather than asserting it explicitly.
 */
export function pcConfigFromSettings(
  settings?: AsteriskIntegrationSettings,
  ephemeralIceServers?: RTCIceServer[],
): RTCConfiguration {
  const iceServers = [
    ...iceServersFromSettings(settings),
    ...(ephemeralIceServers ?? []),
  ];
  return settings?.iceTransportPolicy === "relay"
    ? { iceServers, iceTransportPolicy: "relay" }
    : { iceServers };
}

function toIceServer(server: Record<string, unknown>): RTCIceServer | null {
  const urls = server.urls;
  if (typeof urls !== "string" && !Array.isArray(urls)) return null;

  const normalizedUrls = Array.isArray(urls)
    ? urls.filter((url): url is string => typeof url === "string")
    : urls;
  if (Array.isArray(normalizedUrls) && normalizedUrls.length === 0) {
    return null;
  }

  return {
    urls: normalizedUrls,
    username:
      typeof server.username === "string" ? server.username : undefined,
    credential:
      typeof server.credential === "string" ? server.credential : undefined,
  };
}

function booleanValue(value: unknown) {
  return value === true || value === "true";
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return String(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function iceTransportPolicyValue(value: unknown): "all" | "relay" | undefined {
  return value === "relay" ? "relay" : value === "all" ? "all" : undefined;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function commaSeparatedValue(value: unknown) {
  return stringValue(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jsonObjectArray(value: unknown): Array<Record<string, unknown>> {
  const source = stringValue(value);
  if (!source.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(source);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

function jsonObject(value: unknown): Record<string, unknown> {
  const source = stringValue(value);
  if (!source.trim()) return {};

  try {
    const parsed: unknown = JSON.parse(source);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
