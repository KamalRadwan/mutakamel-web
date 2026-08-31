/**
 * WebPhone management contract for the admin portal.
 *
 * The module returns typed rows, not the retired `asterisk.*` key/value
 * settings, so responses are parsed strictly here rather than trusted. Two
 * values are deliberately absent from every response and therefore from every
 * type below: an ICE server's `credential` and an extension's `sipPassword`.
 * Both are write-only; only `credentialConfigured` / `passwordConfigured` come
 * back, and rendering a stored value is impossible by construction.
 */

export type WebphoneIceServerKind = "STUN" | "TURN";
export type WebphoneIceTransportPolicy = "all" | "relay";
export type WebphoneTransport = "ws" | "wss";

export const WEBPHONE_REGISTER_EXPIRES_MIN = 30;
export const WEBPHONE_REGISTER_EXPIRES_MAX = 86_400;
export const WEBPHONE_TURN_TTL_MIN_SECONDS = 60;
export const WEBPHONE_TURN_TTL_MAX_SECONDS = 86_400;
export const WEBPHONE_ENDPOINT_PRIORITY_MIN = 0;
export const WEBPHONE_ENDPOINT_PRIORITY_MAX = 100;
export const WEBPHONE_ICE_SORT_ORDER_MIN = 0;
export const WEBPHONE_ICE_SORT_ORDER_MAX = 1_000;
export const WEBPHONE_ICE_URLS_MAX = 8;

const WS_URL_PATTERN = /^wss?:\/\/\S+$/iu;
const SIP_DOMAIN_PATTERN = /^[a-z0-9.-]+(?::[0-9]+)?$/iu;
const SIP_URI_PATTERN = /^sip:\S+$/iu;
const ICE_URI_PATTERN = /^(?:stun|stuns|turn|turns):\S+$/iu;
const EXTENSION_PATTERN = /^[0-9*#+]{1,32}$/u;

export interface WebphoneEndpoint {
  id: string;
  label: string | null;
  websocketUrl: string;
  /** Lower is tried first. */
  priority: number;
  enabled: boolean;
}

export interface WebphoneIceServer {
  id: string;
  kind: WebphoneIceServerKind;
  urls: string[];
  username: string | null;
  /** Whether a credential is stored. The credential itself never leaves Core. */
  credentialConfigured: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface WebphoneConfig {
  id: string;
  tenantId: string | null;
  enabled: boolean;
  sipDomain: string;
  realm: string | null;
  outboundProxy: string | null;
  fromDomain: string | null;
  registrarServer: string | null;
  contactUri: string | null;
  registerExpires: number;
  sessionTimers: boolean;
  traceSip: boolean;
  allowInvalidTlsCertificate: boolean;
  iceTransportPolicy: WebphoneIceTransportPolicy;
  defaultCallerId: string | null;
  turnRestEnabled: boolean;
  turnRestTtlSeconds: number;
  endpoints: WebphoneEndpoint[];
  iceServers: WebphoneIceServer[];
}

export interface WebphoneExtension {
  id: string;
  ownerId: string;
  extension: string;
  sipUsername: string;
  /** Whether a SIP password is stored. The password itself is never returned. */
  passwordConfigured: boolean;
  displayName: string | null;
  outboundCallerId: string | null;
  transport: WebphoneTransport;
  enabled: boolean;
}

export interface WebphoneSeats {
  allowed: number;
  occupied: number;
  available: number;
  overAllowance: boolean;
}

export interface WebphoneFleetSeatRow extends WebphoneSeats {
  tenantId: string;
  tenantName: string;
}

/** Editable server-configuration fields, held as form strings. */
export interface WebphoneConfigForm {
  enabled: boolean;
  sipDomain: string;
  realm: string;
  outboundProxy: string;
  fromDomain: string;
  registrarServer: string;
  contactUri: string;
  registerExpires: string;
  sessionTimers: boolean;
  traceSip: boolean;
  allowInvalidTlsCertificate: boolean;
  iceTransportPolicy: WebphoneIceTransportPolicy;
  defaultCallerId: string;
  turnRestEnabled: boolean;
  turnRestTtlSeconds: string;
}

export interface UpdateWebphoneConfigDto {
  enabled?: boolean;
  sipDomain?: string;
  realm?: string | null;
  outboundProxy?: string | null;
  fromDomain?: string | null;
  registrarServer?: string | null;
  contactUri?: string | null;
  registerExpires?: number;
  sessionTimers?: boolean;
  traceSip?: boolean;
  allowInvalidTlsCertificate?: boolean;
  iceTransportPolicy?: WebphoneIceTransportPolicy;
  defaultCallerId?: string | null;
  turnRestEnabled?: boolean;
  turnRestTtlSeconds?: number;
}

export interface EndpointDraft {
  label: string;
  websocketUrl: string;
  priority: string;
  enabled: boolean;
}

export interface CreateWebphoneEndpointDto {
  label?: string | null;
  websocketUrl: string;
  priority?: number;
  enabled?: boolean;
}

export interface UpdateWebphoneEndpointDto {
  label?: string | null;
  websocketUrl?: string;
  priority?: number;
  enabled?: boolean;
}

export interface IceServerDraft {
  kind: WebphoneIceServerKind;
  urls: string;
  username: string;
  credential: string;
  enabled: boolean;
  sortOrder: string;
}

export interface CreateWebphoneIceServerDto {
  kind: WebphoneIceServerKind;
  urls: string[];
  username?: string | null;
  credential?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}

export interface UpdateWebphoneIceServerDto {
  kind?: WebphoneIceServerKind;
  urls?: string[];
  username?: string | null;
  credential?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}

export interface ExtensionDraft {
  ownerId: string;
  extension: string;
  sipUsername: string;
  sipPassword: string;
  displayName: string;
  outboundCallerId: string;
  transport: WebphoneTransport;
  enabled: boolean;
}

export interface CreateWebphoneExtensionDto {
  ownerId: string;
  extension: string;
  sipUsername: string;
  sipPassword?: string | null;
  displayName?: string | null;
  outboundCallerId?: string | null;
  transport?: WebphoneTransport;
  enabled?: boolean;
}

export interface UpdateWebphoneExtensionDto {
  extension?: string;
  sipUsername?: string;
  sipPassword?: string | null;
  displayName?: string | null;
  outboundCallerId?: string | null;
  transport?: WebphoneTransport;
  enabled?: boolean;
}

/** Field-level validation codes; the presentation layer localizes them. */
export type WebphoneFieldErrors = Record<string, string>;

// --- Response parsing --------------------------------------------------------

export function readWebphoneConfig(payload: unknown): WebphoneConfig {
  const config = plainRecord(payload);
  if (
    !config ||
    !nonEmptyString(config.id) ||
    typeof config.enabled !== "boolean" ||
    typeof config.sipDomain !== "string" ||
    typeof config.sessionTimers !== "boolean" ||
    typeof config.traceSip !== "boolean" ||
    typeof config.allowInvalidTlsCertificate !== "boolean" ||
    typeof config.turnRestEnabled !== "boolean" ||
    !boundedInteger(config.registerExpires, 0, WEBPHONE_REGISTER_EXPIRES_MAX) ||
    !boundedInteger(config.turnRestTtlSeconds, 0, WEBPHONE_TURN_TTL_MAX_SECONDS) ||
    !isIceTransportPolicy(config.iceTransportPolicy) ||
    !Array.isArray(config.endpoints) ||
    !Array.isArray(config.iceServers)
  ) {
    invalidResponse("CONFIG");
  }

  return {
    id: config.id as string,
    tenantId: nullableString(config.tenantId),
    enabled: config.enabled as boolean,
    sipDomain: config.sipDomain as string,
    realm: nullableString(config.realm),
    outboundProxy: nullableString(config.outboundProxy),
    fromDomain: nullableString(config.fromDomain),
    registrarServer: nullableString(config.registrarServer),
    contactUri: nullableString(config.contactUri),
    registerExpires: config.registerExpires as number,
    sessionTimers: config.sessionTimers as boolean,
    traceSip: config.traceSip as boolean,
    allowInvalidTlsCertificate: config.allowInvalidTlsCertificate as boolean,
    iceTransportPolicy: config.iceTransportPolicy,
    defaultCallerId: nullableString(config.defaultCallerId),
    turnRestEnabled: config.turnRestEnabled as boolean,
    turnRestTtlSeconds: config.turnRestTtlSeconds as number,
    endpoints: (config.endpoints as unknown[])
      .map(readWebphoneEndpoint)
      .sort((left, right) => left.priority - right.priority),
    iceServers: (config.iceServers as unknown[])
      .map(readWebphoneIceServer)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

export function readWebphoneEndpoint(payload: unknown): WebphoneEndpoint {
  const endpoint = plainRecord(payload);
  if (
    !endpoint ||
    !nonEmptyString(endpoint.id) ||
    !nonEmptyString(endpoint.websocketUrl) ||
    typeof endpoint.enabled !== "boolean" ||
    !boundedInteger(endpoint.priority, 0, WEBPHONE_ENDPOINT_PRIORITY_MAX)
  ) {
    invalidResponse("ENDPOINT");
  }

  return {
    id: endpoint.id as string,
    label: nullableString(endpoint.label),
    websocketUrl: endpoint.websocketUrl as string,
    priority: endpoint.priority as number,
    enabled: endpoint.enabled as boolean,
  };
}

export function readWebphoneIceServer(payload: unknown): WebphoneIceServer {
  const server = plainRecord(payload);
  if (
    !server ||
    !nonEmptyString(server.id) ||
    !isIceServerKind(server.kind) ||
    !Array.isArray(server.urls) ||
    server.urls.length === 0 ||
    !server.urls.every((url) => nonEmptyString(url)) ||
    typeof server.credentialConfigured !== "boolean" ||
    typeof server.enabled !== "boolean" ||
    !boundedInteger(server.sortOrder, 0, WEBPHONE_ICE_SORT_ORDER_MAX)
  ) {
    invalidResponse("ICE_SERVER");
  }

  // A credential must never reach the browser. Treat a response carrying one
  // as a broken contract rather than rendering it.
  if ("credential" in server && server.credential !== undefined) {
    invalidResponse("ICE_SERVER");
  }

  return {
    id: server.id as string,
    kind: server.kind,
    urls: [...(server.urls as string[])],
    username: nullableString(server.username),
    credentialConfigured: server.credentialConfigured as boolean,
    enabled: server.enabled as boolean,
    sortOrder: server.sortOrder as number,
  };
}

export function readWebphoneExtension(payload: unknown): WebphoneExtension {
  const extension = plainRecord(payload);
  if (
    !extension ||
    !nonEmptyString(extension.id) ||
    !nonEmptyString(extension.ownerId) ||
    !nonEmptyString(extension.extension) ||
    !nonEmptyString(extension.sipUsername) ||
    typeof extension.passwordConfigured !== "boolean" ||
    typeof extension.enabled !== "boolean" ||
    !isTransport(extension.transport)
  ) {
    invalidResponse("EXTENSION");
  }

  if ("sipPassword" in extension && extension.sipPassword !== undefined) {
    invalidResponse("EXTENSION");
  }

  return {
    id: extension.id as string,
    ownerId: extension.ownerId as string,
    extension: extension.extension as string,
    sipUsername: extension.sipUsername as string,
    passwordConfigured: extension.passwordConfigured as boolean,
    displayName: nullableString(extension.displayName),
    outboundCallerId: nullableString(extension.outboundCallerId),
    transport: extension.transport,
    enabled: extension.enabled as boolean,
  };
}

export function readWebphoneExtensions(payload: unknown): WebphoneExtension[] {
  const items = Array.isArray(payload)
    ? payload
    : (plainRecord(payload)?.items as unknown);
  if (!Array.isArray(items)) invalidResponse("EXTENSION_LIST");
  return items.map(readWebphoneExtension);
}

/**
 * Seat accounting, derived rather than trusted.
 *
 * `available` and `overAllowance` are recomputed from `allowed` and `occupied`
 * so no response can make the UI print a negative availability. Occupancy above
 * the allowance is a legitimate state — reducing seats never auto-disables a
 * working phone — and is reported as `overAllowance`, not as a negative number.
 */
export function readWebphoneSeats(payload: unknown): WebphoneSeats {
  const seats = plainRecord(payload);
  if (
    !seats ||
    !nonNegativeInteger(seats.allowed) ||
    !nonNegativeInteger(seats.occupied)
  ) {
    invalidResponse("SEATS");
  }

  const allowed = seats.allowed as number;
  const occupied = seats.occupied as number;
  return {
    allowed,
    occupied,
    available: Math.max(0, allowed - occupied),
    overAllowance: occupied > allowed,
  };
}

export function readWebphoneFleetSeats(
  payload: unknown,
): WebphoneFleetSeatRow[] {
  const items = Array.isArray(payload)
    ? payload
    : (plainRecord(payload)?.items as unknown);
  if (!Array.isArray(items)) invalidResponse("FLEET_SEATS");

  return items.map((entry) => {
    const row = plainRecord(entry);
    if (!row || !nonEmptyString(row.tenantId)) invalidResponse("FLEET_SEATS");
    return {
      tenantId: row.tenantId as string,
      tenantName: nonEmptyString(row.tenantName)
        ? (row.tenantName as string)
        : (row.tenantId as string),
      ...readWebphoneSeats(row),
    };
  });
}

// --- Form <-> DTO ------------------------------------------------------------

export function configToForm(config: WebphoneConfig): WebphoneConfigForm {
  return {
    enabled: config.enabled,
    sipDomain: config.sipDomain,
    realm: config.realm ?? "",
    outboundProxy: config.outboundProxy ?? "",
    fromDomain: config.fromDomain ?? "",
    registrarServer: config.registrarServer ?? "",
    contactUri: config.contactUri ?? "",
    registerExpires: String(config.registerExpires),
    sessionTimers: config.sessionTimers,
    traceSip: config.traceSip,
    allowInvalidTlsCertificate: config.allowInvalidTlsCertificate,
    iceTransportPolicy: config.iceTransportPolicy,
    defaultCallerId: config.defaultCallerId ?? "",
    turnRestEnabled: config.turnRestEnabled,
    turnRestTtlSeconds: String(config.turnRestTtlSeconds),
  };
}

export function validateConfigForm(
  form: WebphoneConfigForm,
): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  const sipDomain = form.sipDomain.trim();

  if (sipDomain.length > 253 || (sipDomain && !SIP_DOMAIN_PATTERN.test(sipDomain))) {
    errors.sipDomain = "INVALID_SIP_DOMAIN";
  }
  if (form.enabled && !sipDomain) {
    errors.sipDomain = "SIP_DOMAIN_REQUIRED";
  }
  if (form.realm.trim().length > 253) errors.realm = "TOO_LONG";
  if (form.fromDomain.trim().length > 253) errors.fromDomain = "TOO_LONG";
  if (form.defaultCallerId.trim().length > 64) {
    errors.defaultCallerId = "TOO_LONG";
  }

  for (const field of ["outboundProxy", "registrarServer", "contactUri"] as const) {
    const value = form[field].trim();
    if (value && (value.length > 512 || !SIP_URI_PATTERN.test(value))) {
      errors[field] = "INVALID_SIP_URI";
    }
  }

  if (
    !integerInRange(
      form.registerExpires,
      WEBPHONE_REGISTER_EXPIRES_MIN,
      WEBPHONE_REGISTER_EXPIRES_MAX,
    )
  ) {
    errors.registerExpires = "OUT_OF_RANGE";
  }
  if (
    !integerInRange(
      form.turnRestTtlSeconds,
      WEBPHONE_TURN_TTL_MIN_SECONDS,
      WEBPHONE_TURN_TTL_MAX_SECONDS,
    )
  ) {
    errors.turnRestTtlSeconds = "OUT_OF_RANGE";
  }

  return errors;
}

export function buildConfigPatch(
  config: WebphoneConfig,
  form: WebphoneConfigForm,
): UpdateWebphoneConfigDto {
  const patch: UpdateWebphoneConfigDto = {};
  if (form.enabled !== config.enabled) patch.enabled = form.enabled;
  if (form.sipDomain.trim() !== config.sipDomain) {
    patch.sipDomain = form.sipDomain.trim();
  }
  assignNullable(patch, "realm", form.realm, config.realm);
  assignNullable(patch, "outboundProxy", form.outboundProxy, config.outboundProxy);
  assignNullable(patch, "fromDomain", form.fromDomain, config.fromDomain);
  assignNullable(
    patch,
    "registrarServer",
    form.registrarServer,
    config.registrarServer,
  );
  assignNullable(patch, "contactUri", form.contactUri, config.contactUri);
  assignNullable(
    patch,
    "defaultCallerId",
    form.defaultCallerId,
    config.defaultCallerId,
  );

  const registerExpires = Number(form.registerExpires);
  if (registerExpires !== config.registerExpires) {
    patch.registerExpires = registerExpires;
  }
  const ttl = Number(form.turnRestTtlSeconds);
  if (ttl !== config.turnRestTtlSeconds) patch.turnRestTtlSeconds = ttl;

  if (form.sessionTimers !== config.sessionTimers) {
    patch.sessionTimers = form.sessionTimers;
  }
  if (form.traceSip !== config.traceSip) patch.traceSip = form.traceSip;
  if (form.allowInvalidTlsCertificate !== config.allowInvalidTlsCertificate) {
    patch.allowInvalidTlsCertificate = form.allowInvalidTlsCertificate;
  }
  if (form.iceTransportPolicy !== config.iceTransportPolicy) {
    patch.iceTransportPolicy = form.iceTransportPolicy;
  }
  if (form.turnRestEnabled !== config.turnRestEnabled) {
    patch.turnRestEnabled = form.turnRestEnabled;
  }
  return patch;
}

export const EMPTY_ENDPOINT_DRAFT: EndpointDraft = {
  label: "",
  websocketUrl: "",
  priority: "0",
  enabled: true,
};

export function validateEndpointDraft(draft: EndpointDraft): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  const url = draft.websocketUrl.trim();
  if (!url || url.length > 512 || !WS_URL_PATTERN.test(url)) {
    errors.websocketUrl = "INVALID_WS_URL";
  }
  if (draft.label.trim().length > 64) errors.label = "TOO_LONG";
  if (
    !integerInRange(
      draft.priority,
      WEBPHONE_ENDPOINT_PRIORITY_MIN,
      WEBPHONE_ENDPOINT_PRIORITY_MAX,
    )
  ) {
    errors.priority = "OUT_OF_RANGE";
  }
  return errors;
}

export function endpointDraftToDto(
  draft: EndpointDraft,
): CreateWebphoneEndpointDto {
  const label = draft.label.trim();
  return {
    websocketUrl: draft.websocketUrl.trim(),
    priority: Number(draft.priority),
    enabled: draft.enabled,
    ...(label ? { label } : {}),
  };
}

export const EMPTY_ICE_SERVER_DRAFT: IceServerDraft = {
  kind: "STUN",
  urls: "",
  username: "",
  credential: "",
  enabled: true,
  sortOrder: "0",
};

export function parseIceUrls(value: string): string[] {
  return value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateIceServerDraft(
  draft: IceServerDraft,
): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  const urls = parseIceUrls(draft.urls);
  if (
    urls.length === 0 ||
    urls.length > WEBPHONE_ICE_URLS_MAX ||
    !urls.every((url) => ICE_URI_PATTERN.test(url))
  ) {
    errors.urls = "INVALID_ICE_URLS";
  }
  if (draft.username.trim().length > 128) errors.username = "TOO_LONG";
  if (draft.credential.length > 512) errors.credential = "TOO_LONG";
  if (draft.kind === "STUN" && (draft.username.trim() || draft.credential)) {
    errors.username = "STUN_HAS_NO_CREDENTIALS";
  }
  if (
    draft.kind === "TURN" &&
    Boolean(draft.username.trim()) !== Boolean(draft.credential)
  ) {
    errors.credential = "TURN_CREDENTIAL_PAIR_REQUIRED";
  }
  if (
    !integerInRange(
      draft.sortOrder,
      WEBPHONE_ICE_SORT_ORDER_MIN,
      WEBPHONE_ICE_SORT_ORDER_MAX,
    )
  ) {
    errors.sortOrder = "OUT_OF_RANGE";
  }
  return errors;
}

export function iceServerDraftToDto(
  draft: IceServerDraft,
): CreateWebphoneIceServerDto {
  const username = draft.username.trim();
  return {
    kind: draft.kind,
    urls: parseIceUrls(draft.urls),
    enabled: draft.enabled,
    sortOrder: Number(draft.sortOrder),
    ...(draft.kind === "TURN" && username ? { username } : {}),
    ...(draft.kind === "TURN" && draft.credential
      ? { credential: draft.credential }
      : {}),
  };
}

export const EMPTY_EXTENSION_DRAFT: ExtensionDraft = {
  ownerId: "",
  extension: "",
  sipUsername: "",
  sipPassword: "",
  displayName: "",
  outboundCallerId: "",
  transport: "wss",
  enabled: false,
};

export function validateExtensionDraft(
  draft: ExtensionDraft,
): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  if (!draft.ownerId.trim()) errors.ownerId = "OWNER_REQUIRED";
  if (!EXTENSION_PATTERN.test(draft.extension.trim())) {
    errors.extension = "INVALID_EXTENSION";
  }
  const sipUsername = draft.sipUsername.trim();
  if (!sipUsername || sipUsername.length > 120) {
    errors.sipUsername = "INVALID_SIP_USERNAME";
  }
  if (draft.sipPassword.length > 1024) errors.sipPassword = "TOO_LONG";
  if (draft.enabled && !draft.sipPassword) {
    errors.sipPassword = "PASSWORD_REQUIRED_TO_ENABLE";
  }
  if (draft.displayName.trim().length > 120) errors.displayName = "TOO_LONG";
  if (draft.outboundCallerId.trim().length > 64) {
    errors.outboundCallerId = "TOO_LONG";
  }
  return errors;
}

export function extensionDraftToDto(
  draft: ExtensionDraft,
): CreateWebphoneExtensionDto {
  const displayName = draft.displayName.trim();
  const outboundCallerId = draft.outboundCallerId.trim();
  return {
    ownerId: draft.ownerId.trim(),
    extension: draft.extension.trim(),
    sipUsername: draft.sipUsername.trim(),
    transport: draft.transport,
    enabled: draft.enabled,
    ...(draft.sipPassword ? { sipPassword: draft.sipPassword } : {}),
    ...(displayName ? { displayName } : {}),
    ...(outboundCallerId ? { outboundCallerId } : {}),
  };
}

// --- Local helpers -----------------------------------------------------------

function assignNullable<K extends keyof UpdateWebphoneConfigDto>(
  patch: UpdateWebphoneConfigDto,
  field: K,
  formValue: string,
  serverValue: string | null,
): void {
  const trimmed = formValue.trim();
  const next = trimmed === "" ? null : trimmed;
  if (next !== serverValue) {
    (patch as Record<string, unknown>)[field as string] = next;
  }
}

function integerInRange(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (!/^-?\d+$/u.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function boundedInteger(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function nonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isIceServerKind(value: unknown): value is WebphoneIceServerKind {
  return value === "STUN" || value === "TURN";
}

function isIceTransportPolicy(
  value: unknown,
): value is WebphoneIceTransportPolicy {
  return value === "all" || value === "relay";
}

function isTransport(value: unknown): value is WebphoneTransport {
  return value === "ws" || value === "wss";
}

function invalidResponse(part: string): never {
  throw new Error(`INVALID_WEBPHONE_${part}_RESPONSE`);
}
