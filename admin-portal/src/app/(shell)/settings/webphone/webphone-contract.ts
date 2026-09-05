/**
 * WebPhone management contract for the admin portal.
 *
 * The module returns typed rows, not the retired `asterisk.*` key/value
 * settings, so responses are parsed strictly here rather than trusted. Two
 * values are deliberately absent from every response and therefore from every
 * type below: an ICE server's `credential` and an extension's `sipPassword`.
 * Both are write-only; only `credentialConfigured` / `passwordConfigured` come
 * back, and rendering a stored value is impossible by construction.
 *
 * The module holds many SIP servers, tried in order: every SIP detail belongs
 * to one server row, and a server's transport is the scheme of its own
 * WebSocket URL rather than a field of its own. The extension shapes below are
 * read by the users screen, which is the one place a user's extension is
 * edited; the settings screen is the server chain and nothing else.
 */

export type WebphoneIceServerKind = "STUN" | "TURN";
export type WebphoneIceTransportPolicy = "all" | "relay";
/** The scheme of a server's WebSocket URL; it has no separate column. */
export type WebphoneProtocol = "ws" | "wss";

export const WEBPHONE_REGISTER_EXPIRES_MIN = 30;
export const WEBPHONE_REGISTER_EXPIRES_MAX = 86_400;
export const WEBPHONE_SERVER_PRIORITY_MAX = 1_000;
export const WEBPHONE_ICE_SORT_ORDER_MAX = 1_000;
export const WEBPHONE_ICE_URLS_MAX = 8;
export const WEBPHONE_TIMEOUT_MIN_SECONDS = 1;
export const WEBPHONE_TIMEOUT_MAX_SECONDS = 300;
export const WEBPHONE_MAX_RETRIES_MIN = 0;
export const WEBPHONE_MAX_RETRIES_MAX = 10;

const WS_URL_PATTERN = /^wss?:\/\/\S+$/iu;
const WS_SCHEME_PATTERN = /^wss?:\/\//iu;
const SIP_DOMAIN_PATTERN = /^[a-z0-9.-]+(?::[0-9]+)?$/iu;
const SIP_URI_PATTERN = /^sip:\S+$/iu;
const ICE_URI_PATTERN = /^(?:stun|stuns|turn|turns):\S+$/iu;

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
 * One SIP server and everything the browser needs to register against it.
 *
 * `priority` is the position in the failover chain. It is read here to order
 * the list and is never edited field-by-field: the order is the whole
 * statement, so it is written by reordering the list.
 */
export interface WebphoneServer {
  id: string;
  name: string;
  sipDomain: string;
  websocketUrl: string;
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
  /**
   * The master switch above `iceServers`.
   *
   * The entries below it are returned whole either way — this screen is where
   * the switch is put back, so hiding them would leave nothing to restore. What
   * the flag changes is what the browser is handed: with it off, `GET /me`
   * offers this server no ICE at all and mints it no TURN credential.
   *
   * Like `enabled`, it is owned by its own switch and is deliberately absent
   * from `WebphoneServerForm`: one value with two owners is how a Save button
   * and a toggle come to disagree.
   */
  iceEnabled: boolean;
  traceSip: boolean;
  sessionTimers: boolean;
  allowInvalidTlsCertificate: boolean;
  defaultTimeoutSeconds: number;
  defaultMaxRetries: number;
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
  enabled: boolean;
}

/**
 * One link in a user's failover chain.
 *
 * A null `timeoutSeconds` or `maxRetries` inherits the server's default; it is
 * not a zero. The two are therefore kept nullable all the way to the wire.
 */
export interface WebphoneExtensionServer {
  serverId: string;
  priority: number;
  timeoutSeconds: number | null;
  maxRetries: number | null;
}

/** Editable server fields, held as form strings. Priority is deliberately absent. */
export interface WebphoneServerForm {
  name: string;
  sipDomain: string;
  websocketUrl: string;
  enabled: boolean;
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

export interface CreateWebphoneServerDto {
  name: string;
  sipDomain: string;
  websocketUrl: string;
  enabled?: boolean;
  realm?: string | null;
  outboundProxy?: string | null;
  fromDomain?: string | null;
  registrarServer?: string | null;
  contactUri?: string | null;
  registerExpires?: number;
  defaultCallerId?: string | null;
  iceTransportPolicy?: WebphoneIceTransportPolicy;
  iceEnabled?: boolean;
  traceSip?: boolean;
  sessionTimers?: boolean;
  allowInvalidTlsCertificate?: boolean;
  defaultTimeoutSeconds?: number;
  defaultMaxRetries?: number;
}

export type UpdateWebphoneServerDto = Partial<CreateWebphoneServerDto>;

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

export interface CreateWebphoneExtensionDto {
  ownerId: string;
  extension: string;
  sipUsername: string;
  sipPassword?: string | null;
  displayName?: string | null;
  outboundCallerId?: string | null;
  enabled?: boolean;
}

export interface UpdateWebphoneExtensionDto {
  extension?: string;
  sipUsername?: string;
  sipPassword?: string | null;
  displayName?: string | null;
  outboundCallerId?: string | null;
  enabled?: boolean;
}

/** One row of a user's chain while it is being edited; both overrides are text. */
export interface ExtensionServerRow {
  serverId: string;
  timeoutSeconds: string;
  maxRetries: string;
}

/** Field-level validation codes; the presentation layer localizes them. */
export type WebphoneFieldErrors = Record<string, string>;

// --- Response parsing --------------------------------------------------------

export function readWebphoneServer(payload: unknown): WebphoneServer {
  const server = plainRecord(payload);
  if (
    !server ||
    !nonEmptyString(server.id) ||
    typeof server.name !== "string" ||
    typeof server.sipDomain !== "string" ||
    !nonEmptyString(server.websocketUrl) ||
    typeof server.enabled !== "boolean" ||
    typeof server.iceEnabled !== "boolean" ||
    typeof server.traceSip !== "boolean" ||
    typeof server.sessionTimers !== "boolean" ||
    typeof server.allowInvalidTlsCertificate !== "boolean" ||
    !boundedInteger(server.priority, 0, WEBPHONE_SERVER_PRIORITY_MAX) ||
    !boundedInteger(server.registerExpires, 0, WEBPHONE_REGISTER_EXPIRES_MAX) ||
    !boundedInteger(server.defaultTimeoutSeconds, 0, WEBPHONE_TIMEOUT_MAX_SECONDS) ||
    !boundedInteger(server.defaultMaxRetries, 0, WEBPHONE_MAX_RETRIES_MAX) ||
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
    iceEnabled: server.iceEnabled as boolean,
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
 * The failover chain, lowest priority first.
 *
 * The list arrives ordered, but the order is what the screen renders and what
 * a reorder writes back, so it is re-derived here rather than assumed.
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
    typeof extension.enabled !== "boolean"
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

export function readWebphoneExtensionServer(
  payload: unknown,
): WebphoneExtensionServer {
  const link = plainRecord(payload);
  if (
    !link ||
    !nonEmptyString(link.serverId) ||
    !boundedInteger(link.priority, 0, WEBPHONE_SERVER_PRIORITY_MAX) ||
    !nullableBoundedInteger(
      link.timeoutSeconds,
      0,
      WEBPHONE_TIMEOUT_MAX_SECONDS,
    ) ||
    !nullableBoundedInteger(link.maxRetries, 0, WEBPHONE_MAX_RETRIES_MAX)
  ) {
    invalidResponse("EXTENSION_SERVER");
  }

  return {
    serverId: link.serverId as string,
    priority: link.priority as number,
    // Undefined and null both mean "inherit the server default", so they are
    // collapsed to one representation rather than kept apart.
    timeoutSeconds: (link.timeoutSeconds as number | null | undefined) ?? null,
    maxRetries: (link.maxRetries as number | null | undefined) ?? null,
  };
}

export function readWebphoneExtensionServers(
  payload: unknown,
): WebphoneExtensionServer[] {
  const items = Array.isArray(payload)
    ? payload
    : (plainRecord(payload)?.items as unknown);
  if (!Array.isArray(items)) invalidResponse("EXTENSION_SERVER_LIST");
  return items
    .map(readWebphoneExtensionServer)
    .sort((left, right) => left.priority - right.priority);
}

// --- WebSocket protocol ------------------------------------------------------

/**
 * The protocol control edits the scheme of the WebSocket URL, because that is
 * where a server's transport actually lives — there is no protocol column to
 * disagree with it.
 */
export function websocketProtocol(url: string): WebphoneProtocol {
  return /^ws:\/\//iu.test(url.trim()) ? "ws" : "wss";
}

export function withWebsocketProtocol(
  url: string,
  protocol: WebphoneProtocol,
): string {
  return `${protocol}://${url.trim().replace(WS_SCHEME_PATTERN, "")}`;
}

// --- Server form <-> DTO -----------------------------------------------------

/**
 * The identity a just-created server carries until its operator edits it.
 *
 * Both are required by the API — a blank SIP domain or WebSocket URL is
 * refused — so a placeholder has to stand in. `.invalid` is reserved by
 * RFC 2606 and can never resolve, so a server left half-configured cannot
 * register against somebody else's host by accident.
 */
export const NEW_SERVER_SIP_DOMAIN = "example.invalid";
export const NEW_SERVER_WEBSOCKET_URL = "wss://example.invalid/ws";

/**
 * A free name in the shape `baseName`, `baseName 2`, `baseName 3`...
 *
 * Names are not unique in the database, but two servers called the same thing
 * are indistinguishable in the failover list, in the delete confirmation and in
 * every move button's accessible name — so a new one is numbered on sight.
 */
export function nextServerName(
  servers: readonly WebphoneServer[],
  baseName: string,
): string {
  const taken = new Set(servers.map((server) => server.name.trim()));
  if (!taken.has(baseName)) return baseName;
  // Terminates: `taken` is finite, so some suffix is always free.
  let suffix = 2;
  while (taken.has(`${baseName} ${suffix}`)) suffix += 1;
  return `${baseName} ${suffix}`;
}

/**
 * A blank-but-valid server, created in one click and edited in place.
 *
 * It arrives disabled: the chain is live, and appending an enabled server that
 * still points at a placeholder domain would put real calls onto a host that
 * cannot answer them. The operator enables it once the two identity fields are
 * real.
 */
export function newServerDto(
  servers: readonly WebphoneServer[],
  baseName: string,
): CreateWebphoneServerDto {
  return {
    name: nextServerName(servers, baseName),
    sipDomain: NEW_SERVER_SIP_DOMAIN,
    websocketUrl: NEW_SERVER_WEBSOCKET_URL,
    enabled: false,
    registerExpires: 600,
    iceTransportPolicy: "all",
    // A new server has no ICE entries yet, so the switch above them starts on:
    // it is the state in which adding the first STUN or TURN entry does what
    // the operator expects, and it is the column default besides.
    iceEnabled: true,
    traceSip: false,
    sessionTimers: false,
    allowInvalidTlsCertificate: false,
    defaultTimeoutSeconds: 15,
    defaultMaxRetries: 1,
  };
}

export function serverToForm(server: WebphoneServer): WebphoneServerForm {
  return {
    name: server.name,
    sipDomain: server.sipDomain,
    websocketUrl: server.websocketUrl,
    enabled: server.enabled,
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
 * Validates one server, including the rule that gives relay-only its meaning.
 *
 * Relay-only transport with nothing to relay through is not a configuration
 * that merely performs badly — every call loses its media path — so it is
 * refused here rather than left for the operator to discover on a live call.
 *
 * Two states reach that: no enabled TURN entry, and the server's ICE master
 * switch turned off, which withholds every entry from the browser however many
 * are stored. They are reported as separate codes because the operator's remedy
 * differs — add or enable a TURN entry, versus switch ICE back on — and a
 * message naming the wrong one sends them looking at controls that are already
 * correct.
 */
export function validateServerForm(
  form: WebphoneServerForm,
  iceServers: readonly WebphoneIceServer[] = [],
  iceEnabled = true,
): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  const name = form.name.trim();
  if (!name || name.length > 64) errors.name = "NAME_REQUIRED";

  const sipDomain = form.sipDomain.trim();
  if (!sipDomain) {
    errors.sipDomain = "SIP_DOMAIN_REQUIRED";
  } else if (sipDomain.length > 253 || !SIP_DOMAIN_PATTERN.test(sipDomain)) {
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
    !integerInRange(
      form.defaultMaxRetries,
      WEBPHONE_MAX_RETRIES_MIN,
      WEBPHONE_MAX_RETRIES_MAX,
    )
  ) {
    errors.defaultMaxRetries = "OUT_OF_RANGE";
  }

  if (form.iceTransportPolicy === "relay") {
    // The master switch is checked first: with ICE off the entries below are
    // not offered at all, so pointing the operator at their TURN list would be
    // pointing at a list that is already correct.
    if (!iceEnabled) {
      errors.iceTransportPolicy = "RELAY_REQUIRES_ICE_ENABLED";
    } else if (!hasEnabledTurn(iceServers)) {
      errors.iceTransportPolicy = "RELAY_REQUIRES_TURN";
    }
  }

  return errors;
}

function hasEnabledTurn(iceServers: readonly WebphoneIceServer[]): boolean {
  return iceServers.some((server) => server.kind === "TURN" && server.enabled);
}

export function serverFormToDto(
  form: WebphoneServerForm,
): CreateWebphoneServerDto {
  return {
    name: form.name.trim(),
    sipDomain: form.sipDomain.trim(),
    websocketUrl: form.websocketUrl.trim(),
    enabled: form.enabled,
    realm: emptyToNull(form.realm),
    outboundProxy: emptyToNull(form.outboundProxy),
    fromDomain: emptyToNull(form.fromDomain),
    registrarServer: emptyToNull(form.registrarServer),
    contactUri: emptyToNull(form.contactUri),
    registerExpires: Number(form.registerExpires),
    defaultCallerId: emptyToNull(form.defaultCallerId),
    iceTransportPolicy: form.iceTransportPolicy,
    traceSip: form.traceSip,
    sessionTimers: form.sessionTimers,
    allowInvalidTlsCertificate: form.allowInvalidTlsCertificate,
    defaultTimeoutSeconds: Number(form.defaultTimeoutSeconds),
    defaultMaxRetries: Number(form.defaultMaxRetries),
  };
}

/**
 * The changed fields only. `priority` is never included: the failover order is
 * written by `PUT /servers/order` as one statement about the whole list, so a
 * per-server patch that also moved a server could contradict it.
 */
export function buildServerPatch(
  server: WebphoneServer,
  form: WebphoneServerForm,
): UpdateWebphoneServerDto {
  const patch: UpdateWebphoneServerDto = {};
  const next = serverFormToDto(form);

  if (next.name !== server.name) patch.name = next.name;
  if (next.sipDomain !== server.sipDomain) patch.sipDomain = next.sipDomain;
  if (next.websocketUrl !== server.websocketUrl) {
    patch.websocketUrl = next.websocketUrl;
  }
  if (next.enabled !== server.enabled) patch.enabled = next.enabled;
  if (next.realm !== server.realm) patch.realm = next.realm;
  if (next.outboundProxy !== server.outboundProxy) {
    patch.outboundProxy = next.outboundProxy;
  }
  if (next.fromDomain !== server.fromDomain) patch.fromDomain = next.fromDomain;
  if (next.registrarServer !== server.registrarServer) {
    patch.registrarServer = next.registrarServer;
  }
  if (next.contactUri !== server.contactUri) patch.contactUri = next.contactUri;
  if (next.registerExpires !== server.registerExpires) {
    patch.registerExpires = next.registerExpires;
  }
  if (next.defaultCallerId !== server.defaultCallerId) {
    patch.defaultCallerId = next.defaultCallerId;
  }
  if (next.iceTransportPolicy !== server.iceTransportPolicy) {
    patch.iceTransportPolicy = next.iceTransportPolicy;
  }
  if (next.traceSip !== server.traceSip) patch.traceSip = next.traceSip;
  if (next.sessionTimers !== server.sessionTimers) {
    patch.sessionTimers = next.sessionTimers;
  }
  if (next.allowInvalidTlsCertificate !== server.allowInvalidTlsCertificate) {
    patch.allowInvalidTlsCertificate = next.allowInvalidTlsCertificate;
  }
  if (next.defaultTimeoutSeconds !== server.defaultTimeoutSeconds) {
    patch.defaultTimeoutSeconds = next.defaultTimeoutSeconds;
  }
  if (next.defaultMaxRetries !== server.defaultMaxRetries) {
    patch.defaultMaxRetries = next.defaultMaxRetries;
  }
  return patch;
}

// --- ICE servers -------------------------------------------------------------

export const EMPTY_ICE_SERVER_DRAFT: IceServerDraft = {
  kind: "STUN",
  urls: "",
  username: "",
  credential: "",
  enabled: true,
};

/**
 * Applies a kind change to an ICE draft, dropping what the new kind cannot
 * carry.
 *
 * The credential fields are rendered only for TURN, so changing the kind to
 * STUN while they still hold values leaves the draft in a state the validator
 * rejects (`STUN_HAS_NO_CREDENTIALS`) and the form cannot show — Save then
 * returns before sending anything, with nothing on screen saying why. The one
 * gesture that hides those fields is the one that has to clear them.
 *
 * Kept as a function rather than inline in the change handler because both the
 * edit row and the add form make the same change, and a rule enforced twice by
 * hand is a rule one of them will eventually drop.
 */
export function iceDraftWithKind<
  T extends Pick<IceServerDraft, "kind" | "username" | "credential">,
>(draft: T, kind: WebphoneIceServerKind): T {
  if (kind === draft.kind) return draft;
  return kind === "STUN"
    ? { ...draft, kind, username: "", credential: "" }
    : { ...draft, kind };
}

export function parseIceUrls(value: string): string[] {
  return value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Validates one ICE entry.
 *
 * `credentialStored` is what makes editing an existing TURN entry possible. The
 * credential is write-only, so an edit form always shows it blank; without this
 * flag the pair rule would read that blank as "no credential" and refuse every
 * change to the username of an entry that already has one — a credential the
 * operator cannot retype, because it was never shown to them.
 */
export function validateIceServerDraft(
  draft: IceServerDraft,
  credentialStored = false,
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
    Boolean(draft.username.trim()) !==
      Boolean(draft.credential || credentialStored)
  ) {
    errors.credential = "TURN_CREDENTIAL_PAIR_REQUIRED";
  }
  return errors;
}

/**
 * The validation codes sitting on fields the current kind does not render.
 *
 * A STUN entry shows neither username nor credential, so an error on either has
 * nowhere of its own to appear. Reading a saved STUN entry that carries a
 * username is enough to produce one — the read contract accepts a username on
 * any kind — and without this the row's Save would refuse to send with no
 * visible reason at all.
 */
export function unrenderedIceDraftErrors(
  kind: WebphoneIceServerKind,
  errors: WebphoneFieldErrors,
): string[] {
  if (kind !== "STUN") return [];
  return [errors.username, errors.credential].filter(
    (code): code is string => Boolean(code),
  );
}

/**
 * A new ICE entry, appended to its server's list.
 *
 * `sortOrder` is positional, so it is derived from the list length rather than
 * asked for — one fewer number for an operator to keep consistent by hand.
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
    sortOrder: Math.min(Math.max(sortOrder, 0), WEBPHONE_ICE_SORT_ORDER_MAX),
    ...(draft.kind === "TURN" && username ? { username } : {}),
    ...(draft.kind === "TURN" && draft.credential
      ? { credential: draft.credential }
      : {}),
  };
}

// --- Extension server chain --------------------------------------------------

export function extensionServersToRows(
  chain: readonly WebphoneExtensionServer[],
): ExtensionServerRow[] {
  return chain.map((link) => ({
    serverId: link.serverId,
    timeoutSeconds: link.timeoutSeconds === null ? "" : String(link.timeoutSeconds),
    maxRetries: link.maxRetries === null ? "" : String(link.maxRetries),
  }));
}

/**
 * Validation keyed by `<serverId>.<field>` so a bad override renders against
 * the row that carries it rather than as one message for the whole chain.
 */
export function validateExtensionServerRows(
  rows: readonly ExtensionServerRow[],
): WebphoneFieldErrors {
  const errors: WebphoneFieldErrors = {};
  for (const row of rows) {
    if (
      row.timeoutSeconds.trim() &&
      !integerInRange(
        row.timeoutSeconds,
        WEBPHONE_TIMEOUT_MIN_SECONDS,
        WEBPHONE_TIMEOUT_MAX_SECONDS,
      )
    ) {
      errors[`${row.serverId}.timeoutSeconds`] = "OUT_OF_RANGE";
    }
    if (
      row.maxRetries.trim() &&
      !integerInRange(
        row.maxRetries,
        WEBPHONE_MAX_RETRIES_MIN,
        WEBPHONE_MAX_RETRIES_MAX,
      )
    ) {
      errors[`${row.serverId}.maxRetries`] = "OUT_OF_RANGE";
    }
  }
  return errors;
}

/**
 * The chain for the wire. Position is authoritative: `priority` is the row's
 * index, and a blank override is sent as null so the server default applies
 * rather than a zero that would mean "never wait" or "never retry".
 */
export function rowsToExtensionServers(
  rows: readonly ExtensionServerRow[],
): WebphoneExtensionServer[] {
  return rows.map((row, index) => ({
    serverId: row.serverId,
    priority: index,
    timeoutSeconds: blankToNullInteger(row.timeoutSeconds),
    maxRetries: blankToNullInteger(row.maxRetries),
  }));
}

export function extensionServerRowsChanged(
  rows: readonly ExtensionServerRow[],
  chain: readonly WebphoneExtensionServer[],
): boolean {
  const next = rowsToExtensionServers(rows);
  if (next.length !== chain.length) return true;
  return next.some((link, index) => {
    const current = chain[index];
    return (
      link.serverId !== current.serverId ||
      link.timeoutSeconds !== current.timeoutSeconds ||
      link.maxRetries !== current.maxRetries
    );
  });
}

/** Moves one entry within a list, returning a new list. */
export function moveInList<T>(list: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return [...list];
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// --- Local helpers -----------------------------------------------------------

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function blankToNullInteger(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
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

function nullableBoundedInteger(
  value: unknown,
  min: number,
  max: number,
): boolean {
  return (
    value === null ||
    value === undefined ||
    boundedInteger(value, min, max)
  );
}

function isIceServerKind(value: unknown): value is WebphoneIceServerKind {
  return value === "STUN" || value === "TURN";
}

function isIceTransportPolicy(
  value: unknown,
): value is WebphoneIceTransportPolicy {
  return value === "all" || value === "relay";
}

function invalidResponse(part: string): never {
  throw new Error(`INVALID_WEBPHONE_${part}_RESPONSE`);
}
