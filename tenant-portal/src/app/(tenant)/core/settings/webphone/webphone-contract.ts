/**
 * WebPhone management contract for the tenant portal.
 *
 * The module returns typed rows, so responses are parsed strictly here rather
 * than trusted. Two values are deliberately absent from every response and
 * therefore from every type below: an ICE server's `credential` and an
 * extension's `sipPassword`. Both are write-only; only `credentialConfigured` /
 * `passwordConfigured` come back, and rendering a stored value is impossible by
 * construction.
 *
 * A scope used to hold exactly one SIP server, so its settings and that
 * server's settings were one object. They are now two: `/servers` carries an
 * ordered list, each entry owning its own SIP fields and its own ICE set, and
 * `/config` carries only what is left — a derived `enabled`. ICE moved onto the
 * server because a relay is only reachable inside the network its server lives
 * in — one shared TURN set would hand servers in other networks candidates that
 * cannot work.
 *
 * There is nothing to write at scope level any more, so every form type below
 * belongs to a server, an ICE entry, or an extension. `/config` is read-only:
 * the scope has no stored settings row, so there is no `PATCH` for one.
 */

export type WebphoneIceServerKind = "STUN" | "TURN";
export type WebphoneIceTransportPolicy = "all" | "relay";
export type WebphoneTransport = "ws" | "wss";

const WEBPHONE_SERVER_NAME_MAX = 80;
const WEBPHONE_REGISTER_EXPIRES_MIN = 30;
const WEBPHONE_REGISTER_EXPIRES_MAX = 86_400;
const WEBPHONE_PRIORITY_MIN = 1;
const WEBPHONE_PRIORITY_MAX = 100;
const WEBPHONE_TIMEOUT_MIN_SECONDS = 3;
const WEBPHONE_TIMEOUT_MAX_SECONDS = 120;
const WEBPHONE_RETRIES_MIN = 0;
const WEBPHONE_RETRIES_MAX = 10;
const WEBPHONE_ICE_SORT_ORDER_MIN = 0;
const WEBPHONE_ICE_SORT_ORDER_MAX = 1_000;
const WEBPHONE_ICE_URLS_MAX = 8;

const WS_URL_PATTERN = /^wss?:\/\/\S+$/iu;
const WS_SCHEME_PATTERN = /^wss?:\/\//iu;
const SIP_DOMAIN_PATTERN = /^[a-z0-9.-]+(?::[0-9]+)?$/iu;
const SIP_URI_PATTERN = /^sip:\S+$/iu;
const ICE_URI_PATTERN = /^(?:stun|stuns|turn|turns):\S+$/iu;
const EXTENSION_PATTERN = /^[A-Za-z0-9*#+._-]{1,32}$/u;

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

/**
 * One SIP server in the scope's failover chain.
 *
 * `priority` is contiguous from 1 and unique per scope, and the reorder
 * endpoint is the only thing that writes it: a drag moves several rows at once,
 * so a per-row update could not keep the ordering consistent between the first
 * write and the last. It is therefore a position to display, never a field to
 * edit — see `WebphoneServerForm`, which does not carry it.
 *
 * There is no `protocol`: the transport is the scheme of `websocketUrl`, and a
 * second copy of that fact is how the two drift apart.
 */
export interface WebphoneServer {
  id: string;
  name: string;
  sipDomain: string;
  websocketUrl: string;
  /** Lower is tried first. Written only by `PUT /servers/order`. */
  priority: number;
  enabled: boolean;
  realm: string | null;
  outboundProxy: string | null;
  fromDomain: string | null;
  registrarServer: string | null;
  contactUri: string | null;
  registerExpires: number;
  defaultCallerId: string | null;
  iceTransportPolicy: WebphoneIceTransportPolicy;
  traceSip: boolean;
  sessionTimers: boolean;
  allowInvalidTlsCertificate: boolean;
  /** How long this server is worth waiting for before the phone moves on. */
  defaultTimeoutSeconds: number;
  defaultMaxRetries: number;
  iceServers: WebphoneIceServer[];
}

/**
 * Scope-wide state, all of it derived and none of it stored.
 *
 * `enabled` is a fact about the servers below, not a setting beside them: the
 * scope is on when it holds an enabled server carrying both a SIP domain and a
 * WebSocket URL. There is therefore nothing here to edit — switching WebPhone
 * on means giving it a working server.
 *
 * The response also echoes `tenantId`, which this screen never renders; it is
 * left unparsed for the same reason an extension's `tenantId` is.
 */
export interface WebphoneScopeConfig {
  enabled: boolean;
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

/**
 * One server's editable fields.
 *
 * Two of the server's own properties are deliberately missing. `priority` is
 * owned by the reorder endpoint, so offering it here would be an edit the API
 * refuses to honour. `enabled` is owned by the card's toggle, which writes it
 * immediately: holding a second copy in a form that is saved later is how a
 * stale draft silently switches a working server back off.
 */
export interface WebphoneServerForm {
  name: string;
  sipDomain: string;
  websocketUrl: string;
  realm: string;
  outboundProxy: string;
  fromDomain: string;
  registrarServer: string;
  contactUri: string;
  registerExpires: string;
  defaultCallerId: string;
  iceTransportPolicy: WebphoneIceTransportPolicy;
  traceSip: boolean;
  sessionTimers: boolean;
  allowInvalidTlsCertificate: boolean;
  defaultTimeoutSeconds: string;
  defaultMaxRetries: string;
}

/** The add-a-server form: the basics only. Everything else has a default. */
export interface ServerDraft {
  name: string;
  sipDomain: string;
  websocketUrl: string;
  enabled: boolean;
}

export interface CreateWebphoneServerDto {
  name: string;
  sipDomain: string;
  websocketUrl: string;
  enabled?: boolean;
}

export interface UpdateWebphoneServerDto {
  name?: string;
  sipDomain?: string;
  websocketUrl?: string;
  enabled?: boolean;
  realm?: string | null;
  outboundProxy?: string | null;
  fromDomain?: string | null;
  registrarServer?: string | null;
  contactUri?: string | null;
  registerExpires?: number;
  defaultCallerId?: string | null;
  iceTransportPolicy?: WebphoneIceTransportPolicy;
  traceSip?: boolean;
  sessionTimers?: boolean;
  allowInvalidTlsCertificate?: boolean;
  defaultTimeoutSeconds?: number;
  defaultMaxRetries?: number;
}

export interface IceServerDraft {
  kind: WebphoneIceServerKind;
  urls: string;
  username: string;
  credential: string;
  enabled: boolean;
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

/**
 * Strips the Core response envelope from a WebPhone payload.
 *
 * WebPhone is mounted into `core-app` but is its **own** Gateway namespace,
 * `/api/tenant/webphone/v1` — it is not a section under the Core prefix, and
 * `docs/api/webphone.md` is explicit that the Core-shaped spelling of it 404s.
 * `src/lib/api/envelope.ts` therefore has no reader
 * that will accept these paths: `readCoreData` takes a `CorePath`, and a
 * webphone path is not assignable to it. That type separation is deliberate
 * (S1 / MASTER-PLAN 3.20) and must not be loosened to let a fourth namespace
 * through the Core door, so the unwrap lives here, next to the validators that
 * consume it, rather than being imported from the transport.
 *
 * The shape is Core's: `{ success, data, correlationId }`. Anything without a
 * `data` key passes through untouched, which is what a `204` and a bare
 * payload both need.
 */
export function unwrapWebphoneEnvelope(payload: unknown): unknown {
  const envelope = plainRecord(payload);
  return envelope && "data" in envelope ? envelope.data : payload;
}

export function readWebphoneConfig(payload: unknown): WebphoneScopeConfig {
  const config = plainRecord(payload);
  if (!config || typeof config.enabled !== "boolean") {
    invalidResponse("CONFIG");
  }

  return { enabled: config.enabled as boolean };
}

export function readWebphoneServer(payload: unknown): WebphoneServer {
  const server = plainRecord(payload);
  if (
    !server ||
    !nonEmptyString(server.id) ||
    !nonEmptyString(server.name) ||
    !nonEmptyString(server.sipDomain) ||
    !nonEmptyString(server.websocketUrl) ||
    typeof server.enabled !== "boolean" ||
    typeof server.traceSip !== "boolean" ||
    typeof server.sessionTimers !== "boolean" ||
    typeof server.allowInvalidTlsCertificate !== "boolean" ||
    !boundedInteger(server.priority, WEBPHONE_PRIORITY_MIN, WEBPHONE_PRIORITY_MAX) ||
    !boundedInteger(server.registerExpires, 0, WEBPHONE_REGISTER_EXPIRES_MAX) ||
    !boundedInteger(
      server.defaultTimeoutSeconds,
      WEBPHONE_TIMEOUT_MIN_SECONDS,
      WEBPHONE_TIMEOUT_MAX_SECONDS,
    ) ||
    !boundedInteger(
      server.defaultMaxRetries,
      WEBPHONE_RETRIES_MIN,
      WEBPHONE_RETRIES_MAX,
    ) ||
    !isIceTransportPolicy(server.iceTransportPolicy) ||
    !Array.isArray(server.iceServers)
  ) {
    invalidResponse("SERVER");
  }

  return {
    id: server.id as string,
    name: server.name as string,
    sipDomain: server.sipDomain as string,
    websocketUrl: server.websocketUrl as string,
    priority: server.priority as number,
    enabled: server.enabled as boolean,
    realm: nullableString(server.realm),
    outboundProxy: nullableString(server.outboundProxy),
    fromDomain: nullableString(server.fromDomain),
    registrarServer: nullableString(server.registrarServer),
    contactUri: nullableString(server.contactUri),
    registerExpires: server.registerExpires as number,
    defaultCallerId: nullableString(server.defaultCallerId),
    iceTransportPolicy: server.iceTransportPolicy,
    traceSip: server.traceSip as boolean,
    sessionTimers: server.sessionTimers as boolean,
    allowInvalidTlsCertificate: server.allowInvalidTlsCertificate as boolean,
    defaultTimeoutSeconds: server.defaultTimeoutSeconds as number,
    defaultMaxRetries: server.defaultMaxRetries as number,
    iceServers: (server.iceServers as unknown[])
      .map(readWebphoneIceServer)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

/**
 * The failover chain, in the order it will be tried.
 *
 * Sorted here rather than trusting the response order: the position badge and
 * the reorder payload are both built from this array, so a response that came
 * back out of order would otherwise show one order and save another.
 */
export function readWebphoneServers(payload: unknown): WebphoneServer[] {
  const items = Array.isArray(payload)
    ? payload
    : (plainRecord(payload)?.items as unknown);
  if (!Array.isArray(items)) invalidResponse("SERVER_LIST");
  return items
    .map(readWebphoneServer)
    .sort((left, right) => left.priority - right.priority);
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
    !boundedInteger(server.sortOrder, WEBPHONE_ICE_SORT_ORDER_MIN, WEBPHONE_ICE_SORT_ORDER_MAX)
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

// --- WebSocket URL and its protocol -----------------------------------------

/**
 * The transport a WebSocket URL states in its scheme.
 *
 * The API has no protocol field on either side — the URL is the single source
 * of that fact — so the protocol control reads and rewrites the scheme instead
 * of storing a second copy that could disagree with it. An unrecognized or
 * half-typed URL reads as `wss`, which is the value the control should be
 * sitting on while the operator finishes typing.
 */
export function websocketProtocol(url: string): WebphoneTransport {
  return /^ws:\/\//iu.test(url.trim()) ? "ws" : "wss";
}

export function withWebsocketProtocol(
  url: string,
  protocol: WebphoneTransport,
): string {
  return `${protocol}://${url.trim().replace(WS_SCHEME_PATTERN, "")}`;
}

// --- Form <-> DTO ------------------------------------------------------------

export function serverToForm(server: WebphoneServer): WebphoneServerForm {
  return {
    name: server.name,
    sipDomain: server.sipDomain,
    websocketUrl: server.websocketUrl,
    realm: server.realm ?? "",
    outboundProxy: server.outboundProxy ?? "",
    fromDomain: server.fromDomain ?? "",
    registrarServer: server.registrarServer ?? "",
    contactUri: server.contactUri ?? "",
    registerExpires: String(server.registerExpires),
    defaultCallerId: server.defaultCallerId ?? "",
    iceTransportPolicy: server.iceTransportPolicy,
    traceSip: server.traceSip,
    sessionTimers: server.sessionTimers,
    allowInvalidTlsCertificate: server.allowInvalidTlsCertificate,
    defaultTimeoutSeconds: String(server.defaultTimeoutSeconds),
    defaultMaxRetries: String(server.defaultMaxRetries),
  };
}

/**
 * Validates one server, including the rule that cannot be checked from the
 * form alone: relay-only transport with no enabled TURN entry leaves every call
 * on this server without a media path, so the save is refused rather than sent
 * and bounced. The rule is per server now — each one carries its own ICE set.
 */
export function validateServerForm(
  form: WebphoneServerForm,
  iceServers: readonly WebphoneIceServer[],
): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  const name = form.name.trim();
  if (!name || name.length > WEBPHONE_SERVER_NAME_MAX) {
    errors.name = "INVALID_SERVER_NAME";
  }

  const sipDomain = form.sipDomain.trim();
  if (!sipDomain || sipDomain.length > 253 || !SIP_DOMAIN_PATTERN.test(sipDomain)) {
    errors.sipDomain = "INVALID_SIP_DOMAIN";
  }

  const websocketUrl = form.websocketUrl.trim();
  if (
    !websocketUrl ||
    websocketUrl.length > 512 ||
    !WS_URL_PATTERN.test(websocketUrl)
  ) {
    errors.websocketUrl = "INVALID_WS_URL";
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
      form.defaultTimeoutSeconds,
      WEBPHONE_TIMEOUT_MIN_SECONDS,
      WEBPHONE_TIMEOUT_MAX_SECONDS,
    )
  ) {
    errors.defaultTimeoutSeconds = "OUT_OF_RANGE";
  }
  if (
    !integerInRange(form.defaultMaxRetries, WEBPHONE_RETRIES_MIN, WEBPHONE_RETRIES_MAX)
  ) {
    errors.defaultMaxRetries = "OUT_OF_RANGE";
  }

  if (form.iceTransportPolicy === "relay" && !hasEnabledTurn(iceServers)) {
    errors.iceTransportPolicy = "RELAY_REQUIRES_TURN";
  }

  return errors;
}

function hasEnabledTurn(iceServers: readonly WebphoneIceServer[]): boolean {
  return iceServers.some((server) => server.kind === "TURN" && server.enabled);
}

export function buildServerPatch(
  server: WebphoneServer,
  form: WebphoneServerForm,
): UpdateWebphoneServerDto {
  const patch: UpdateWebphoneServerDto = {};
  if (form.name.trim() !== server.name) patch.name = form.name.trim();
  if (form.sipDomain.trim() !== server.sipDomain) {
    patch.sipDomain = form.sipDomain.trim();
  }
  if (form.websocketUrl.trim() !== server.websocketUrl) {
    patch.websocketUrl = form.websocketUrl.trim();
  }

  assignNullable(patch, "realm", form.realm, server.realm);
  assignNullable(patch, "outboundProxy", form.outboundProxy, server.outboundProxy);
  assignNullable(patch, "fromDomain", form.fromDomain, server.fromDomain);
  assignNullable(
    patch,
    "registrarServer",
    form.registrarServer,
    server.registrarServer,
  );
  assignNullable(patch, "contactUri", form.contactUri, server.contactUri);
  assignNullable(
    patch,
    "defaultCallerId",
    form.defaultCallerId,
    server.defaultCallerId,
  );

  assignNumber(patch, "registerExpires", form.registerExpires, server.registerExpires);
  assignNumber(
    patch,
    "defaultTimeoutSeconds",
    form.defaultTimeoutSeconds,
    server.defaultTimeoutSeconds,
  );
  assignNumber(
    patch,
    "defaultMaxRetries",
    form.defaultMaxRetries,
    server.defaultMaxRetries,
  );

  if (form.iceTransportPolicy !== server.iceTransportPolicy) {
    patch.iceTransportPolicy = form.iceTransportPolicy;
  }
  if (form.traceSip !== server.traceSip) patch.traceSip = form.traceSip;
  if (form.sessionTimers !== server.sessionTimers) {
    patch.sessionTimers = form.sessionTimers;
  }
  if (form.allowInvalidTlsCertificate !== server.allowInvalidTlsCertificate) {
    patch.allowInvalidTlsCertificate = form.allowInvalidTlsCertificate;
  }
  return patch;
}

/** A fresh server starts on `wss:`, so the protocol control has a value to sit on. */
export const EMPTY_SERVER_DRAFT: ServerDraft = {
  name: "",
  sipDomain: "",
  websocketUrl: "wss://",
  enabled: true,
};

export function validateServerDraft(draft: ServerDraft): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  const name = draft.name.trim();
  if (!name || name.length > WEBPHONE_SERVER_NAME_MAX) {
    errors.name = "INVALID_SERVER_NAME";
  }
  const sipDomain = draft.sipDomain.trim();
  if (!sipDomain || sipDomain.length > 253 || !SIP_DOMAIN_PATTERN.test(sipDomain)) {
    errors.sipDomain = "INVALID_SIP_DOMAIN";
  }
  const url = draft.websocketUrl.trim();
  if (!url || url.length > 512 || !WS_URL_PATTERN.test(url)) {
    errors.websocketUrl = "INVALID_WS_URL";
  }
  return errors;
}

/**
 * `priority` is absent on purpose: the server appends the new entry to the end
 * of the chain, and the reorder endpoint is the only thing that renumbers.
 */
export function serverDraftToDto(draft: ServerDraft): CreateWebphoneServerDto {
  return {
    name: draft.name.trim(),
    sipDomain: draft.sipDomain.trim(),
    websocketUrl: draft.websocketUrl.trim(),
    enabled: draft.enabled,
  };
}

export const EMPTY_ICE_SERVER_DRAFT: IceServerDraft = {
  kind: "STUN",
  urls: "",
  username: "",
  credential: "",
  enabled: true,
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
  return errors;
}

/**
 * `sortOrder` is not a field on the row — it is the position the caller is
 * appending at, so a new entry lands after the ones already there instead of
 * asking an operator to invent a number.
 */
export function iceServerDraftToDto(
  draft: IceServerDraft,
  sortOrder: number,
): CreateWebphoneIceServerDto {
  const username = draft.username.trim();
  return {
    kind: draft.kind,
    urls: parseIceUrls(draft.urls),
    enabled: draft.enabled,
    sortOrder: Math.min(sortOrder, WEBPHONE_ICE_SORT_ORDER_MAX),
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

/**
 * The full id list in the order a move produces.
 *
 * `PUT /servers/order` takes the whole chain, not a delta, so the move is
 * computed here and the caller sends the result verbatim. An out-of-range index
 * returns the list unchanged rather than dropping an id — a reorder must never
 * be able to lose a server.
 */
export function moveServerId(
  ids: readonly string[],
  from: number,
  to: number,
): string[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) {
    return [...ids];
  }
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// --- Local helpers -----------------------------------------------------------

function assignNullable<K extends keyof UpdateWebphoneServerDto>(
  patch: UpdateWebphoneServerDto,
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

function assignNumber<K extends keyof UpdateWebphoneServerDto>(
  patch: UpdateWebphoneServerDto,
  field: K,
  formValue: string,
  serverValue: number,
): void {
  const next = Number(formValue);
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
