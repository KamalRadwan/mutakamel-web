export type WebphoneIceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

/**
 * One SIP WebSocket transport. The API returns enabled endpoints only,
 * ordered by `priority` ascending (lowest first).
 */
export type WebphoneEndpoint = {
  websocketUrl: string;
  priority: number;
};

/**
 * The resolved runtime configuration served with the caller's own extension.
 * The client never parses raw settings — it maps this straight to JsSIP.
 */
export type WebphoneRuntimeConfig = {
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
  /**
   * WebRTC ICE transport policy. 'relay' forces all media through a
   * configured TURN server instead of attempting a direct/STUN path.
   */
  iceTransportPolicy: "all" | "relay";
  endpoints: WebphoneEndpoint[];
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
  transport: "ws" | "wss";
  passwordConfigured: boolean;
  config: WebphoneRuntimeConfig;
  turnCredentials: WebphoneTurnCredentials;
};

export type WebphoneCallLogType = "IN_ANS" | "IN_NOANS" | "OUT";

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
  | "disconnected"
  | "connectFailed"
  | "incomingCall"
  | "calling"
  | "ringing"
  | "startingCall"
  | "callEnded"
  | "declined"
  | "callFailed"
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
  | "permissionDenied";

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
