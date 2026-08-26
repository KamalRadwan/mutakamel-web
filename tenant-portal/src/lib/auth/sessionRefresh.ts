import { isDefinitiveAuthFailure } from "./sessionErrors";

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const REFRESH_MIN_LEAD_MS = 10_000;
const REFRESH_MAX_LEAD_MS = 60_000;
const REFRESH_LEAD_RATIO = 0.2;
const DEADLINE_BOUND_TTL_SECONDS = 60;
const MAX_TIMER_DELAY_MS = 2_147_000_000;

export interface TenantRefreshTiming {
  savedAt: number;
  expiresIn: number;
  eventId: string;
}

export interface TenantSessionRefreshScheduler {
  wake: () => void;
  stop: () => void;
}

interface SchedulerOptions {
  getTiming: () => TenantRefreshTiming | null;
  refresh: () => Promise<void>;
  canRefresh: () => boolean;
  now?: () => number;
}

export function getTenantRefreshDelayMs(
  timing: TenantRefreshTiming,
  now = Date.now(),
): number {
  if (!validTiming(timing)) return 0;
  const lifetimeMs = timing.expiresIn * 1_000;
  const leadMs = timing.expiresIn < DEADLINE_BOUND_TTL_SECONDS
    ? 0
    : Math.min(
        REFRESH_MAX_LEAD_MS,
        Math.max(REFRESH_MIN_LEAD_MS, lifetimeMs * REFRESH_LEAD_RATIO),
      );
  return Math.max(0, timing.savedAt + lifetimeMs - leadMs - now);
}

export function startTenantSessionRefreshScheduler({
  getTiming,
  refresh,
  canRefresh,
  now = Date.now,
}: SchedulerOptions): TenantSessionRefreshScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let running = false;
  let rearmRequested = false;
  let retryAttempt = 0;
  let retryAt = 0;
  let retryBaseline: TenantRefreshTiming | null = null;

  const readTiming = (): TenantRefreshTiming | null => {
    const timing = getTiming();
    return timing && validTiming(timing) ? { ...timing } : null;
  };

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const resetRetry = () => {
    retryAttempt = 0;
    retryAt = 0;
    retryBaseline = null;
  };

  const schedule = () => {
    clearTimer();
    if (stopped || !canRefresh()) return;

    const timing = readTiming();
    if (retryAt > 0 && isNewerTiming(timing, retryBaseline)) resetRetry();
    const delay = retryAt > now()
      ? retryAt - now()
      : timing
        ? getTenantRefreshDelayMs(timing, now())
        : 0;
    timer = setTimeout(() => {
      timer = null;
      void runRefresh();
    }, Math.min(MAX_TIMER_DELAY_MS, Math.max(0, delay)));
  };

  const scheduleRetry = (baseline: TenantRefreshTiming | null) => {
    retryBaseline = baseline;
    retryAt = now() + Math.min(
      RETRY_BASE_MS * 2 ** Math.min(retryAttempt, 30),
      RETRY_MAX_MS,
    );
    retryAttempt += 1;
    schedule();
  };

  const runRefresh = async () => {
    if (stopped || !canRefresh()) return;
    if (running) {
      rearmRequested = true;
      return;
    }

    running = true;
    const startedTiming = readTiming();
    try {
      await refresh();
      if (stopped) return;
      const refreshedTiming = readTiming();
      if (!isNewerTiming(refreshedTiming, startedTiming)) {
        scheduleRetry(startedTiming);
      } else {
        resetRetry();
        schedule();
      }
    } catch (error) {
      if (stopped) return;
      if (isDefinitiveAuthFailure(error)) {
        stopped = true;
        clearTimer();
        return;
      }
      const latestTiming = readTiming();
      if (isNewerTiming(latestTiming, startedTiming)) {
        resetRetry();
        schedule();
      } else {
        scheduleRetry(startedTiming);
      }
    } finally {
      running = false;
      if (!stopped && rearmRequested) {
        rearmRequested = false;
        schedule();
      }
    }
  };

  schedule();
  return {
    wake: schedule,
    stop: () => {
      stopped = true;
      rearmRequested = false;
      clearTimer();
    },
  };
}

function isNewerTiming(
  candidate: TenantRefreshTiming | null,
  baseline: TenantRefreshTiming | null,
): boolean {
  if (!candidate) return false;
  if (!baseline) return true;
  return (
    candidate.savedAt > baseline.savedAt ||
    (candidate.savedAt === baseline.savedAt &&
      candidate.eventId !== baseline.eventId)
  );
}

function validTiming(timing: TenantRefreshTiming): boolean {
  return (
    Number.isFinite(timing.savedAt) &&
    timing.savedAt > 0 &&
    Number.isFinite(timing.expiresIn) &&
    timing.expiresIn > 0 &&
    typeof timing.eventId === "string" &&
    timing.eventId.length > 0
  );
}
