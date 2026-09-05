export type WebphoneIceServer = {
  /** `stun` or `turn`. Informational — the browser reads the scheme off `urls`. */
  kind: string;
  urls: string[];
  username?: string;
  credential?: string;
};

/**
 * One complete SIP registration target. The API returns enabled servers only,
 * ordered by `priority` ascending (1 first).
 *
 * Every field a REGISTER depends on lives here rather than in a shared scope:
 * two servers may disagree on realm, registrar, proxy, contact and ICE set, so
 * they are alternatives to each other, not two transports for one identity.
 * That is why failover replaces the whole UA instead of swapping a socket.
 */
export type WebphoneServer = {
  id: string;
  /** Operator-facing name, shown in the widget while this server is in use. */
  name: string;
  priority: number;
  sipDomain: string;
  /** The `ws://` / `wss://` scheme is the transport; there is no separate field. */
  websocketUrl: string;
  realm: string | null;
  outboundProxy: string | null;
  fromDomain: string | null;
  registrarServer: string | null;
  contactUri: string | null;
  registerExpires: number;
  /** Caller ID for outbound calls placed through this server. */
  defaultCallerId: string | null;
  /**
   * WebRTC ICE transport policy. 'relay' forces all media through a
   * configured TURN server instead of attempting a direct/STUN path.
   */
  iceTransportPolicy: "all" | "relay";
  traceSip: boolean;
  sessionTimers: boolean;
  allowInvalidTlsCertificate: boolean;
  /** How long this server gets to accept a registration before the phone moves on. */
  timeoutSeconds: number;
  /** How many registration attempts this server gets before the phone moves on. */
  maxRetries: number;
  iceServers: WebphoneIceServer[];
};

/**
 * Ephemeral TURN credentials minted server-side (coturn REST convention).
 * They are appended to the static ICE servers, never a replacement.
 */
export type WebphoneTurnCredentials = {
  enabled: boolean;
  iceServers: Array<{ urls: string[]; username: string; credential: string }>;
  expiresAt: string | null;
};

/** The full `GET {base}/me` payload: everything the widget needs to run. */
export type WebphoneMe = {
  enabled: boolean;
  extension: string | null;
  sipUsername: string | null;
  /** Decrypted for this session only — never persisted by the client. */
  sipPassword: string | null;
  displayName: string | null;
  outboundCallerId: string | null;
  passwordConfigured: boolean;
  /** Ordered by priority, best first. The phone registers against one at a time. */
  servers: WebphoneServer[];
  turnCredentials: WebphoneTurnCredentials;
};

/**
 * The outcome of one call, in both directions.
 *
 * `OUT` predates the split and is kept because rows already carry it: it says
 * a call went out and nothing about how it ended. Nothing should write it any
 * more — use `OUT_ANS`, `OUT_NOANS` or `OUT_BUSY`, which is the distinction the
 * log's colour depends on.
 */
export type WebphoneCallLogType =
  | "IN_ANS"
  | "IN_NOANS"
  | "IN_BUSY"
  | "OUT_ANS"
  | "OUT_NOANS"
  | "OUT_BUSY"
  | "OUT";

export type WebphoneCallLog = {
  id?: string;
  type: WebphoneCallLogType;
  displayName?: string | null;
  phoneNumber: string;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
  createdAt?: string | null;
};

export type CreateWebphoneCallLogPayload = Omit<
  WebphoneCallLog,
  "id" | "createdAt"
>;

export type WebphoneConnectionState =
  | "idle"
  | "loading"
  | "ready"
  | "connecting"
  | "registered"
  | "offline"
  | "error";

export type WebphoneStatusCode =
  | "idle"
  | "loadingPhone"
  | "disabled"
  | "ready"
  | "notConfigured"
  | "unavailable"
  | "connecting"
  | "socketConnected"
  | "registering"
  | "registered"
  | "registrationFailed"
  | "failingOver"
  | "disconnected"
  | "connectFailed"
  | "incomingCall"
  | "calling"
  | "ringing"
  | "startingCall"
  | "callEnded"
  | "declined"
  | "callFailed"
  | "transferring"
  | "transferFailed"
  | "inCall";

export type WebphoneStatus = {
  code: WebphoneStatusCode;
  /** Raw technical detail (SIP cause, error message) — not localized. */
  detail?: string;
};

export type WebphoneMediaNoticeCode =
  | "requiresHttps"
  | "unavailable"
  | "stopped"
  | "muted"
  | "clickToAllow"
  | "permissionDenied"
  | "noMicrophone";

export type WebphoneCallState =
  | "idle"
  | "calling"
  | "incoming"
  | "ringing"
  | "active"
  | "ended"
  | "failed";

export type WebphoneTab = "phone" | "log";

export type ActiveCallContext = {
  direction: "incoming" | "outgoing";
  number: string;
  displayName?: string | null;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
};
