import { safeStorage } from "../safeStorage";

export type TenantAuthEventKind = "session-updated" | "session-ended";

export interface TenantAuthEventTimingSnapshot {
  expiresIn: number;
  sessionExpiresIn: number;
  authorizationVersion: number;
  profileVersion: number;
}

export interface TenantAuthEventTiming extends TenantAuthEventTimingSnapshot {
  savedAt?: number;
}

export interface TenantAuthEvent {
  realm: "tenant";
  kind: TenantAuthEventKind;
  eventId: string;
  sourceId: string;
  issuedAt: number;
  sessionId: string;
  timing?: TenantAuthEventTimingSnapshot;
}

export type TenantAuthLifecycleState =
  | "STALE"
  | "REFRESHING"
  | "AUTHENTICATED"
  | "DEGRADED"
  | "ENDED";

const STORAGE_KEY = "tenant_auth_session_event";
const CHANNEL_NAME = "tenant_auth_session";
const LOCAL_EVENT_NAME = "tenant-auth-session-event";
const LIFECYCLE_EVENT_NAME = "tenant-auth-lifecycle";
const sourceId = createOpaqueId();

export function readLatestTenantAuthEvent(): TenantAuthEvent | null {
  return parseTenantAuthEvent(safeStorage.getItem(STORAGE_KEY));
}

export function publishTenantAuthEvent(
  kind: TenantAuthEventKind,
  sessionId: string,
  notifyCurrentTab = true,
  timing?: TenantAuthEventTiming,
): TenantAuthEvent {
  if (!validSessionId(sessionId)) {
    throw new TypeError("Tenant auth events require an exact session ID.");
  }
  if (kind === "session-ended" && timing !== undefined) {
    throw new TypeError("Session-ended auth events cannot include timing.");
  }
  const normalizedTiming = timing && parsePublishedTiming(timing);
  if (timing && !normalizedTiming) {
    throw new TypeError("Tenant auth event timing is invalid.");
  }
  const event: TenantAuthEvent = {
    realm: "tenant",
    kind,
    eventId: createOpaqueId(),
    sourceId,
    issuedAt: normalizedTiming?.savedAt ?? Date.now(),
    sessionId,
    ...(normalizedTiming
      ? {
          timing: {
            expiresIn: normalizedTiming.expiresIn,
            sessionExpiresIn: normalizedTiming.sessionExpiresIn,
            authorizationVersion: normalizedTiming.authorizationVersion,
            profileVersion: normalizedTiming.profileVersion,
          },
        }
      : {}),
  };
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(event));

  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(event);
      channel.close();
    } catch {
      // localStorage events remain the cross-tab fallback in restricted modes.
    }
  }
  if (notifyCurrentTab && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<TenantAuthEvent>(LOCAL_EVENT_NAME, { detail: event }),
    );
  }
  return event;
}

export function publishTenantAuthLifecycle(
  state: TenantAuthLifecycleState,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TenantAuthLifecycleState>(LIFECYCLE_EVENT_NAME, {
      detail: state,
    }),
  );
}

export function subscribeToTenantAuthEvents(
  listener: (event: TenantAuthEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const seen = new Set<string>();
  const deliver = (candidate: unknown, allowCurrentSource = false) => {
    const event = parseTenantAuthEvent(candidate);
    if (
      !event ||
      seen.has(event.eventId) ||
      (!allowCurrentSource && event.sourceId === sourceId)
    ) {
      return;
    }
    seen.add(event.eventId);
    listener(event);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) deliver(event.newValue);
  };
  const onLocal = (event: Event) =>
    deliver((event as CustomEvent<unknown>).detail, true);

  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_EVENT_NAME, onLocal);
  let channel: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener("message", (event) => deliver(event.data));
    } catch {
      channel = null;
    }
  }
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
    channel?.close();
  };
}

export function subscribeToTenantAuthLifecycle(
  listener: (state: TenantAuthLifecycleState) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onLifecycle = (event: Event) => {
    const state = (event as CustomEvent<unknown>).detail;
    if (
      state === "STALE" ||
      state === "REFRESHING" ||
      state === "AUTHENTICATED" ||
      state === "DEGRADED" ||
      state === "ENDED"
    ) {
      listener(state);
    }
  };
  window.addEventListener(LIFECYCLE_EVENT_NAME, onLifecycle);
  return () => window.removeEventListener(LIFECYCLE_EVENT_NAME, onLifecycle);
}

function parseTenantAuthEvent(value: unknown): TenantAuthEvent | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const candidate = parsed as Partial<TenantAuthEvent>;
  if (
    candidate.realm !== "tenant" ||
    (candidate.kind !== "session-updated" && candidate.kind !== "session-ended") ||
    typeof candidate.eventId !== "string" ||
    typeof candidate.sourceId !== "string" ||
    !positiveInteger(candidate.issuedAt) ||
    !validSessionId(candidate.sessionId)
  ) {
    return null;
  }
  if (candidate.kind === "session-ended" && candidate.timing !== undefined) {
    return null;
  }
  const timing = candidate.timing && parseTiming(candidate.timing);
  if (candidate.timing && !timing) return null;
  return {
    realm: "tenant",
    kind: candidate.kind,
    eventId: candidate.eventId,
    sourceId: candidate.sourceId,
    issuedAt: candidate.issuedAt,
    sessionId: candidate.sessionId,
    ...(timing ? { timing } : {}),
  };
}

function parsePublishedTiming(
  value: TenantAuthEventTiming,
): TenantAuthEventTiming | null {
  const timing = parseTiming(value);
  if (!timing || (value.savedAt !== undefined && !positiveInteger(value.savedAt))) {
    return null;
  }
  return {
    ...timing,
    ...(value.savedAt !== undefined ? { savedAt: value.savedAt } : {}),
  };
}

function parseTiming(value: unknown): TenantAuthEventTimingSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<TenantAuthEventTimingSnapshot>;
  if (
    !positiveInteger(candidate.expiresIn) ||
    !positiveInteger(candidate.sessionExpiresIn) ||
    !positiveInteger(candidate.authorizationVersion) ||
    !positiveInteger(candidate.profileVersion)
  ) {
    return null;
  }
  return {
    expiresIn: candidate.expiresIn,
    sessionExpiresIn: candidate.sessionExpiresIn,
    authorizationVersion: candidate.authorizationVersion,
    profileVersion: candidate.profileVersion,
  };
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function createOpaqueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
