export const ADMIN_REFRESH_SKEW_MS = 60_000;
export const ADMIN_REFRESH_MINIMUM_DELAY_MS = 5_000;
export const ADMIN_REFRESH_TRANSIENT_RETRY_MS = 30_000;

export interface RefreshScheduleMetadata {
  savedAt: number;
  expiresIn: number;
}

interface AdminSessionRefreshSchedulerOptions {
  getMetadata: () => RefreshScheduleMetadata | null;
  refresh: () => Promise<void>;
  onDefinitiveFailure: () => void;
  transientRetryMs?: number;
}

export function getAdminRefreshDelayMs(
  metadata: RefreshScheduleMetadata,
  now = Date.now(),
): number {
  const expiresAt = metadata.savedAt + metadata.expiresIn * 1_000;
  return Math.max(
    expiresAt - now - ADMIN_REFRESH_SKEW_MS,
    ADMIN_REFRESH_MINIMUM_DELAY_MS,
  );
}

export function getAuthErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;

  return typeof status === "number" ? status : undefined;
}

export function isDefinitiveAuthFailure(error: unknown): boolean {
  const status = getAuthErrorStatus(error);
  return status === 401 || status === 403;
}

export function startAdminSessionRefreshScheduler({
  getMetadata,
  refresh,
  onDefinitiveFailure,
  transientRetryMs = ADMIN_REFRESH_TRANSIENT_RETRY_MS,
}: AdminSessionRefreshSchedulerOptions): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (overrideDelayMs?: number) => {
    if (stopped) return;

    const metadata = getMetadata();
    if (!metadata?.expiresIn) return;

    const delayMs = overrideDelayMs ?? getAdminRefreshDelayMs(metadata);
    timer = setTimeout(() => {
      void runRefresh();
    }, delayMs);
  };

  const runRefresh = async () => {
    if (stopped) return;

    const currentMetadata = getMetadata();
    if (!currentMetadata) return;

    // A reactive refresh may have renewed the session after this timer was
    // scheduled. Re-arm from that newer metadata instead of rotating early.
    if (
      getAdminRefreshDelayMs(currentMetadata) >
      ADMIN_REFRESH_MINIMUM_DELAY_MS
    ) {
      schedule();
      return;
    }

    try {
      await refresh();
      schedule();
    } catch (error) {
      if (isDefinitiveAuthFailure(error)) {
        stopped = true;
        onDefinitiveFailure();
        return;
      }

      schedule(transientRetryMs);
    }
  };

  schedule();

  return () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
