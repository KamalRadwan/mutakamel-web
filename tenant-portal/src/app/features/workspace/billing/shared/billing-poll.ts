export const PAYMENT_POLL = { intervalMs: 5_000, attempts: 60 } as const;

export function operationPollDelay(elapsedMs: number, retryAfterSeconds: number | null): number {
  return Math.max(elapsedMs < 30_000 ? 2_000 : 5_000, (retryAfterSeconds ?? 0) * 1_000);
}
