import { safeStorage } from "../safeStorage";

export type AdminAuthEventKind = "session-updated" | "session-ended";

interface AdminAuthEventTimingSnapshot {
  expiresIn: number;
  sessionExpiresIn: number;
  authorizationVersion: number;
  profileVersion: number;
}

export interface AdminAuthEventTiming extends AdminAuthEventTimingSnapshot {
  savedAt?: number;
}

export interface AdminAuthEvent {
  realm: "admin";
  kind: AdminAuthEventKind;
  eventId: string;
  sourceId: string;
  issuedAt: number;
  sessionId?: string;
  timing?: AdminAuthEventTimingSnapshot;
}

export type AdminAuthLifecycleState =
  | "STALE"
  | "REFRESHING"
  | "AUTHENTICATED"
  | "DEGRADED"
  | "ENDED";

const STORAGE_KEY = "admin_auth_session_event";
const CHANNEL_NAME = "admin_auth_session";
const LOCAL_EVENT_NAME = "admin-auth-session-event";
const LIFECYCLE_EVENT_NAME = "admin-auth-lifecycle";

const sourceId = createOpaqueId();

export function readLatestAdminAuthEvent(): AdminAuthEvent | null {
  return parseAdminAuthEvent(safeStorage.getItem(STORAGE_KEY));
}

export function publishAdminAuthEvent(
  kind: AdminAuthEventKind,
  sessionId?: string,
  notifyCurrentTab = true,
  timing?: AdminAuthEventTiming,
): AdminAuthEvent {
  if (kind === "session-ended" && timing !== undefined) {
    throw new TypeError("Session-ended auth events cannot include timing.");
  }

  const normalizedTiming =
    timing === undefined ? undefined : parsePublishedTiming(timing);
  if (timing !== undefined && !normalizedTiming) {
    throw new TypeError("Admin auth event timing is invalid.");
  }

  const event: AdminAuthEvent = {
    realm: "admin",
    kind,
    eventId: createOpaqueId(),
    sourceId,
    issuedAt: normalizedTiming?.savedAt ?? Date.now(),
    ...(sessionId ? { sessionId } : {}),
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
      new CustomEvent<AdminAuthEvent>(LOCAL_EVENT_NAME, { detail: event }),
    );
  }

  return event;
}

export function publishAdminAuthLifecycle(
  state: AdminAuthLifecycleState,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AdminAuthLifecycleState>(LIFECYCLE_EVENT_NAME, {
      detail: state,
    }),
  );
}

export function subscribeToAdminAuthEvents(
  listener: (event: AdminAuthEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const seen = new Set<string>();
  const deliver = (candidate: unknown, allowCurrentSource = false) => {
    const event = parseAdminAuthEvent(candidate);
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
  const onLocal = (event: Event) => {
    deliver((event as CustomEvent<unknown>).detail, true);
  };

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

export function subscribeToAdminAuthLifecycle(
  listener: (state: AdminAuthLifecycleState) => void,
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

function parseAdminAuthEvent(value: unknown): AdminAuthEvent | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const candidate = parsed as Partial<AdminAuthEvent>;
  if (
    candidate.realm !== "admin" ||
    (candidate.kind !== "session-updated" &&
      candidate.kind !== "session-ended") ||
    typeof candidate.eventId !== "string" ||
    typeof candidate.sourceId !== "string" ||
    !isPositiveInteger(candidate.issuedAt) ||
    (candidate.sessionId !== undefined &&
      typeof candidate.sessionId !== "string")
  ) {
    return null;
  }

  if (candidate.kind === "session-ended" && candidate.timing !== undefined) {
    return null;
  }

  const timing =
    candidate.timing === undefined
      ? undefined
      : parseTimingSnapshot(candidate.timing);
  if (candidate.timing !== undefined && !timing) {
    return null;
  }

  return {
    realm: "admin",
    kind: candidate.kind,
    eventId: candidate.eventId,
    sourceId: candidate.sourceId,
    issuedAt: candidate.issuedAt,
    ...(candidate.sessionId !== undefined
      ? { sessionId: candidate.sessionId }
      : {}),
    ...(timing ? { timing } : {}),
  };
}

function parsePublishedTiming(
  value: AdminAuthEventTiming,
): AdminAuthEventTiming | null {
  const timing = parseTimingSnapshot(value);
  if (
    !timing ||
    (value.savedAt !== undefined && !isPositiveInteger(value.savedAt))
  ) {
    return null;
  }
  return {
    ...timing,
    ...(value.savedAt !== undefined ? { savedAt: value.savedAt } : {}),
  };
}

function parseTimingSnapshot(value: unknown): AdminAuthEventTimingSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<AdminAuthEventTimingSnapshot>;
  if (
    !isPositiveInteger(candidate.expiresIn) ||
    !isPositiveInteger(candidate.sessionExpiresIn) ||
    !isPositiveInteger(candidate.authorizationVersion) ||
    !isPositiveInteger(candidate.profileVersion)
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function createOpaqueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
