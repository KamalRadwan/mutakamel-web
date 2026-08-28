export type AuthFailureDisposition =
  | "refresh"
  | "end"
  | "forbidden"
  | "retain"
  | "none";

export const ADMIN_AUTH_RETRY_BASE_MS = 1_000;
export const ADMIN_AUTH_RETRY_MAX_MS = 30_000;
const ADMIN_REFRESH_MIN_LEAD_MS = 10_000;
const ADMIN_REFRESH_MAX_LEAD_MS = 60_000;
export const ADMIN_REFRESH_MAX_EARLY_JITTER_MS = 5_000;

const ADMIN_REFRESH_LEAD_RATIO = 0.2;
const ADMIN_REFRESH_DEADLINE_BOUND_TTL_SECONDS = 60;
const ADMIN_REFRESH_MIN_TIMER_DELAY_MS = 1;

type ScheduledRefreshKind = "timing" | "retry";

export interface RefreshScheduleTiming {
  savedAt: number;
  /** Access-token lifetime in seconds, measured from `savedAt`. */
  expiresIn: number;
}

export interface AdminSessionRefreshScheduler {
  /** Re-arm the timer from the latest timing metadata. */
  reschedule: () => void;
  /** Re-check immediately after focus, visibility, pageshow, or online events. */
  wake: () => void;
  /** Cancel future work. An already-running refresh is allowed to settle. */
  stop: () => void;
}

interface AdminSessionRefreshSchedulerOptions {
  getTiming: () => RefreshScheduleTiming | null;
  refresh: () => Promise<void>;
  onTerminal: (error: unknown) => void;
  now?: () => number;
  random?: () => number;
  maxEarlyJitterMs?: number;
}

const SESSION_ENDING_AUTH_CODES = new Set([
  "AUTH_SESSION_ENDED",
  "AUTH_SESSION_IDLE_EXPIRED",
  "AUTH_SESSION_ABSOLUTE_EXPIRED",
  "AUTH_SECURITY_STALE",
  "AUTH_SESSION_STALE",
  "SESSION_IDENTITY_INACTIVE",
  "INVALID_REFRESH_TOKEN",
]);

export function getAuthErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;
  return typeof status === "number" ? status : undefined;
}

export function getAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    code?: unknown;
    errorCode?: unknown;
    response?: { data?: { code?: unknown; errorCode?: unknown } };
  };
  const code =
    candidate.code ??
    candidate.errorCode ??
    candidate.response?.data?.errorCode ??
    candidate.response?.data?.code;
  return typeof code === "string" ? code : undefined;
}

export function classifyAuthFailure(
  status: number | undefined,
  code?: string,
): AuthFailureDisposition {
  if (
    (status === 401 || status === 403) &&
    isSessionEndingAuthCode(code)
  ) {
    return "end";
  }
  if (status === 403) return "forbidden";
  if (status === 401) return "refresh";
  if (status === 429 || status === undefined || (status >= 500 && status <= 599)) {
    return "retain";
  }
  return "none";
}

export function isDefinitiveAuthFailure(error: unknown): boolean {
  const status = getAuthErrorStatus(error);
  return (
    (status === 401 || status === 403) &&
    isSessionEndingAuthCode(getAuthErrorCode(error))
  );
}

function isSessionEndingAuthCode(code?: string): boolean {
  return code !== undefined && SESSION_ENDING_AUTH_CODES.has(code);
}

export function getAdminAuthRetryDelayMs(failedAttemptCount: number): number {
  const normalizedAttempt = Number.isFinite(failedAttemptCount)
    ? Math.max(0, Math.floor(failedAttemptCount))
    : 0;
  const boundedExponent = Math.min(normalizedAttempt, 30);
  return Math.min(
    ADMIN_AUTH_RETRY_BASE_MS * 2 ** boundedExponent,
    ADMIN_AUTH_RETRY_MAX_MS,
  );
}

export function getAdminRefreshLeadMs(expiresIn: number): number {
  const lifetimeMs =
    Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1_000 : 0;
  if (lifetimeMs === 0) return 0;

  // Core bounds the access JWT to the remaining idle/absolute session
  // lifetime. Once that lifetime is short, background refresh cannot extend
  // it, so refresh at expiry instead of repeatedly issuing ever-shorter JWTs.
  if (expiresIn < ADMIN_REFRESH_DEADLINE_BOUND_TTL_SECONDS) return 0;

  return Math.min(
    ADMIN_REFRESH_MAX_LEAD_MS,
    Math.max(
      ADMIN_REFRESH_MIN_LEAD_MS,
      Math.round(lifetimeMs * ADMIN_REFRESH_LEAD_RATIO),
    ),
  );
}

export function getAdminRefreshDelayMs(
  timing: RefreshScheduleTiming,
  now = Date.now(),
  earlyJitterMs = 0,
): number {
  if (!isValidRefreshScheduleTiming(timing)) return 0;

  const currentTime = Number.isFinite(now) ? now : Date.now();
  const lifetimeMs = timing.expiresIn * 1_000;
  const refreshOffsetMs =
    lifetimeMs - getAdminRefreshLeadMs(timing.expiresIn);
  const requestedJitter =
    timing.expiresIn >= ADMIN_REFRESH_DEADLINE_BOUND_TTL_SECONDS &&
    Number.isFinite(earlyJitterMs) &&
    earlyJitterMs > 0
      ? earlyJitterMs
      : 0;
  // Cap against the timing's fixed refresh offset, rather than the remaining
  // delay at each read. This leaves a positive first timer without producing
  // a one-millisecond rescheduling loop as the refresh point approaches.
  const jitter = Math.min(
    requestedJitter,
    Math.max(0, refreshOffsetMs - ADMIN_REFRESH_MIN_TIMER_DELAY_MS),
  );
  const refreshAt = timing.savedAt + refreshOffsetMs - jitter;
  return Math.max(0, refreshAt - currentTime);
}

export function isAdminRefreshDue(
  timing: RefreshScheduleTiming | null,
  now = Date.now(),
  earlyJitterMs = 0,
): boolean {
  if (!timing) return true;
  return getAdminRefreshDelayMs(timing, now, earlyJitterMs) === 0;
}

export function startAdminSessionRefreshScheduler({
  getTiming,
  refresh,
  onTerminal,
  now = Date.now,
  random = Math.random,
  maxEarlyJitterMs = ADMIN_REFRESH_MAX_EARLY_JITTER_MS,
}: AdminSessionRefreshSchedulerOptions): AdminSessionRefreshScheduler {
  let stopped = false;
  let refreshRunning = false;
  let rearmRequested = false;
  let failedAttemptCount = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let scheduledKind: ScheduledRefreshKind | null = null;
  let scheduledTiming: RefreshScheduleTiming | null = null;
  let scheduledTimingFingerprint: string | null = null;
  let refreshStartedTiming: RefreshScheduleTiming | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    scheduledKind = null;
    scheduledTiming = null;
    scheduledTimingFingerprint = null;
  };

  const readTiming = (): RefreshScheduleTiming | null => {
    const timing = getTiming();
    return timing && isValidRefreshScheduleTiming(timing)
      ? { savedAt: timing.savedAt, expiresIn: timing.expiresIn }
      : null;
  };

  const sampleEarlyJitterMs = () => {
    const maximum =
      Number.isFinite(maxEarlyJitterMs) && maxEarlyJitterMs > 0
        ? maxEarlyJitterMs
        : 0;
    const sample = random();
    const normalizedSample = Number.isFinite(sample)
      ? Math.min(1, Math.max(0, sample))
      : 0;
    return Math.floor(maximum * normalizedSample);
  };

  const schedule = (
    overrideDelayMs?: number,
    kind: ScheduledRefreshKind = "timing",
  ) => {
    if (stopped) return;
    clearTimer();

    const timing = readTiming();
    const timingFingerprint = getRefreshTimingFingerprint(timing);
    const delayMs =
      overrideDelayMs ??
      (timing
        ? getAdminRefreshDelayMs(timing, now(), sampleEarlyJitterMs())
        : 0);
    scheduledKind = kind;
    scheduledTiming = timing;
    scheduledTimingFingerprint = timingFingerprint;
    timer = setTimeout(() => {
      timer = null;
      scheduledKind = null;
      scheduledTiming = null;
      scheduledTimingFingerprint = null;

      const latestTiming = readTiming();
      if (
        getRefreshTimingFingerprint(latestTiming) !== timingFingerprint &&
        isDemonstrablyNewerTiming(latestTiming, timing)
      ) {
        failedAttemptCount = 0;
        schedule();
        return;
      }
      void runRefresh(latestTiming);
    }, Math.max(0, delayMs));
  };

  const scheduleRetry = () => {
    const retryDelayMs = getAdminAuthRetryDelayMs(failedAttemptCount);
    failedAttemptCount += 1;
    schedule(retryDelayMs, "retry");
  };

  const runRefresh = async (startedTiming = readTiming()) => {
    if (stopped) return;
    if (refreshRunning) {
      if (isDemonstrablyNewerTiming(startedTiming, refreshStartedTiming)) {
        rearmRequested = true;
      }
      return;
    }

    refreshRunning = true;
    refreshStartedTiming = startedTiming;
    try {
      await refresh();
      if (stopped) return;

      // A successful refresh is expected to publish demonstrably newer timing.
      // Missing or unchanged storage is still a repair failure: keep bounded
      // backoff instead of immediately reusing an already-due fingerprint.
      const refreshedTiming = readTiming();
      if (!isDemonstrablyNewerTiming(refreshedTiming, startedTiming)) {
        scheduleRetry();
        return;
      }
      failedAttemptCount = 0;
      schedule();
    } catch (error) {
      if (stopped) return;
      if (isDefinitiveAuthFailure(error)) {
        stopped = true;
        clearTimer();
        onTerminal(error);
        return;
      }
      const latestTiming = readTiming();
      if (isDemonstrablyNewerTiming(latestTiming, startedTiming)) {
        failedAttemptCount = 0;
        schedule();
      } else {
        scheduleRetry();
      }
    } finally {
      refreshRunning = false;
      const refreshBaseline = refreshStartedTiming;
      refreshStartedTiming = null;
      if (!stopped && rearmRequested) {
        rearmRequested = false;
        const latestTiming = readTiming();
        if (isDemonstrablyNewerTiming(latestTiming, refreshBaseline)) {
          failedAttemptCount = 0;
          schedule();
        }
      }
    }
  };

  const rearm = () => {
    if (stopped) return;
    const latestTiming = readTiming();
    const baseline = refreshRunning ? refreshStartedTiming : scheduledTiming;
    const timingAdvanced =
      getRefreshTimingFingerprint(latestTiming) !==
        (refreshRunning
          ? getRefreshTimingFingerprint(refreshStartedTiming)
          : scheduledTimingFingerprint) &&
      isDemonstrablyNewerTiming(latestTiming, baseline);

    if (refreshRunning) {
      if (timingAdvanced) rearmRequested = true;
      return;
    }
    // Focus/visibility/online events re-evaluate ordinary expiry timers, but
    // unchanged timing must not shorten or reset an active transient retry.
    if (scheduledKind === "retry" && !timingAdvanced) return;
    if (timingAdvanced) failedAttemptCount = 0;
    schedule();
  };

  schedule();

  return {
    reschedule: rearm,
    wake: rearm,
    stop: () => {
      stopped = true;
      rearmRequested = false;
      refreshStartedTiming = null;
      clearTimer();
    },
  };
}

function getRefreshTimingFingerprint(
  timing: RefreshScheduleTiming | null,
): string | null {
  return timing ? `${timing.savedAt}:${timing.expiresIn}` : null;
}

function isDemonstrablyNewerTiming(
  candidate: RefreshScheduleTiming | null,
  baseline: RefreshScheduleTiming | null,
): boolean {
  if (!candidate || !isValidRefreshScheduleTiming(candidate)) return false;
  if (!baseline || !isValidRefreshScheduleTiming(baseline)) return true;
  if (candidate.savedAt > baseline.savedAt) return true;
  return (
    candidate.savedAt === baseline.savedAt &&
    getRefreshTimingFingerprint(candidate) !==
      getRefreshTimingFingerprint(baseline)
  );
}

function isValidRefreshScheduleTiming(
  timing: RefreshScheduleTiming,
): boolean {
  return (
    Number.isFinite(timing.savedAt) &&
    timing.savedAt >= 0 &&
    Number.isFinite(timing.expiresIn) &&
    timing.expiresIn > 0
  );
}
