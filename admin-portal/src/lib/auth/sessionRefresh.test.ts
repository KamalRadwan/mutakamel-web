import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_REFRESH_MINIMUM_DELAY_MS,
  ADMIN_REFRESH_TRANSIENT_RETRY_MS,
  getAdminRefreshDelayMs,
  startAdminSessionRefreshScheduler,
} from "./sessionRefresh";

describe("admin session refresh scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes before expiry and re-arms after every successful rotation", async () => {
    let metadata = { savedAt: Date.now(), expiresIn: 120 };
    const refresh = vi.fn(async () => {
      metadata = { savedAt: Date.now(), expiresIn: 120 };
    });

    const stop = startAdminSessionRefreshScheduler({
      getMetadata: () => metadata,
      refresh,
      onDefinitiveFailure: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("retries transient refresh failures without ending the session", async () => {
    const metadata = { savedAt: Date.now(), expiresIn: 60 };
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("gateway unavailable"), { status: 503 }))
      .mockResolvedValue(undefined);
    const onDefinitiveFailure = vi.fn();

    const stop = startAdminSessionRefreshScheduler({
      getMetadata: () => metadata,
      refresh,
      onDefinitiveFailure,
    });

    await vi.advanceTimersByTimeAsync(ADMIN_REFRESH_MINIMUM_DELAY_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onDefinitiveFailure).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(ADMIN_REFRESH_TRANSIENT_RETRY_MS);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("stops and fails closed after a definitive refresh rejection", async () => {
    const metadata = { savedAt: Date.now(), expiresIn: 60 };
    const refresh = vi.fn().mockRejectedValue(
      Object.assign(new Error("refresh rejected"), { status: 401 }),
    );
    const onDefinitiveFailure = vi.fn();

    startAdminSessionRefreshScheduler({
      getMetadata: () => metadata,
      refresh,
      onDefinitiveFailure,
    });

    await vi.advanceTimersByTimeAsync(ADMIN_REFRESH_MINIMUM_DELAY_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onDefinitiveFailure).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(ADMIN_REFRESH_TRANSIENT_RETRY_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("uses the minimum delay when the session is already inside the skew window", () => {
    expect(
      getAdminRefreshDelayMs({ savedAt: 0, expiresIn: 30 }, 0),
    ).toBe(ADMIN_REFRESH_MINIMUM_DELAY_MS);
  });
});
