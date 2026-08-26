import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTenantRefreshDelayMs,
  startTenantSessionRefreshScheduler,
  type TenantRefreshTiming,
} from "./sessionRefresh";

describe("tenant proactive refresh timing", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    [600, 540_000],
    [100, 80_000],
    [60, 48_000],
    [59, 59_000],
  ])("schedules a %ss token after %sms", (expiresIn, expectedDelay) => {
    const now = 1_000_000;
    expect(getTenantRefreshDelayMs({
      savedAt: now,
      expiresIn,
      eventId: "event-a",
    }, now)).toBe(expectedDelay);
  });

  it("refreshes once at the pre-expiry boundary and rearms from new timing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    let timing: TenantRefreshTiming = {
      savedAt: Date.now(),
      expiresIn: 100,
      eventId: "event-a",
    };
    const refresh = vi.fn(async () => {
      timing = {
        savedAt: Date.now(),
        expiresIn: 100,
        eventId: "event-b",
      };
    });
    const scheduler = startTenantSessionRefreshScheduler({
      getTiming: () => timing,
      canRefresh: () => true,
      refresh,
    });

    await vi.advanceTimersByTimeAsync(79_999);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(79_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it("stays paused while hidden and refreshes when explicitly woken", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    let visible = false;
    let timing: TenantRefreshTiming = {
      savedAt: Date.now() - 100_000,
      expiresIn: 100,
      eventId: "event-a",
    };
    const refresh = vi.fn(async () => {
      timing = { ...timing, savedAt: Date.now(), eventId: "event-b" };
    });
    const scheduler = startTenantSessionRefreshScheduler({
      getTiming: () => timing,
      canRefresh: () => visible,
      refresh,
    });

    await vi.advanceTimersByTimeAsync(120_000);
    expect(refresh).not.toHaveBeenCalled();
    visible = true;
    scheduler.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("keeps refresh single-flight across repeated wake signals", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    let timing: TenantRefreshTiming = {
      savedAt: Date.now() - 100_000,
      expiresIn: 100,
      eventId: "event-a",
    };
    let complete!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => {
      complete = () => {
        timing = { ...timing, savedAt: Date.now(), eventId: "event-b" };
        resolve();
      };
    }));
    const scheduler = startTenantSessionRefreshScheduler({
      getTiming: () => timing,
      canRefresh: () => true,
      refresh,
    });
    await vi.advanceTimersByTimeAsync(0);
    scheduler.wake();
    scheduler.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    complete();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("retries transient failures but stops on a definitive session end", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const timing = {
      savedAt: Date.now() - 100_000,
      expiresIn: 100,
      eventId: "event-a",
    };
    const transient = { response: { status: 503, data: { code: "UNAVAILABLE" } } };
    const terminal = {
      response: { status: 401, data: { code: "AUTH_SESSION_ENDED" } },
    };
    const refresh = vi.fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(terminal);
    startTenantSessionRefreshScheduler({
      getTiming: () => timing,
      canRefresh: () => true,
      refresh,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
