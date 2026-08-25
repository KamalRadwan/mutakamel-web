import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_AUTH_RETRY_BASE_MS,
  ADMIN_AUTH_RETRY_MAX_MS,
  ADMIN_REFRESH_MAX_EARLY_JITTER_MS,
  classifyAuthFailure,
  getAdminAuthRetryDelayMs,
  getAdminRefreshDelayMs,
  getAdminRefreshLeadMs,
  getAuthErrorCode,
  getAuthErrorStatus,
  isAdminRefreshDue,
  isDefinitiveAuthFailure,
  startAdminSessionRefreshScheduler,
  type RefreshScheduleTiming,
} from "./sessionRefresh";

describe("admin auth failure classification", () => {
  it.each([
    "AUTH_SESSION_ENDED",
    "AUTH_SESSION_IDLE_EXPIRED",
    "AUTH_SESSION_ABSOLUTE_EXPIRED",
    "AUTH_SECURITY_STALE",
    "AUTH_SESSION_STALE",
    "SESSION_IDENTITY_INACTIVE",
    "INVALID_REFRESH_TOKEN",
  ])("ends the browser session for %s", (code) => {
    expect(classifyAuthFailure(401, code)).toBe("end");
    expect(
      isDefinitiveAuthFailure({ response: { status: 401, data: { code } } }),
    ).toBe(true);
  });

  it("ends on the explicit inactive-identity code even though Core uses 403", () => {
    const error = {
      response: {
        status: 403,
        data: { code: "SESSION_IDENTITY_INACTIVE" },
      },
    };
    expect(classifyAuthFailure(403, "SESSION_IDENTITY_INACTIVE")).toBe("end");
    expect(isDefinitiveAuthFailure(error)).toBe(true);
  });

  it.each([
    "COMMON.AUTH.TOKEN_EXPIRED",
    "AUTH_AUTHORIZATION_STALE",
    "AUTH_PROFILE_STALE",
    "COMMON.AUTH.MISSING_TOKEN",
  ])("refreshes once for non-terminal 401 code %s", (code) => {
    expect(classifyAuthFailure(401, code)).toBe("refresh");
  });

  it("never refreshes a permission denial", () => {
    expect(classifyAuthFailure(403, "PERMISSION_DENIED")).toBe("forbidden");
  });

  it.each([undefined, 429, 500, 503])(
    "retains local auth for transient status %s",
    (status) => {
      expect(classifyAuthFailure(status, "AUTH_SESSION_CHECK_UNAVAILABLE")).toBe(
        "retain",
      );
    },
  );

  it("reads normalized status and error code", () => {
    const error = {
      response: {
        status: 401,
        data: { errorCode: "AUTH_PROFILE_STALE" },
      },
    };
    expect(getAuthErrorStatus(error)).toBe(401);
    expect(getAuthErrorCode(error)).toBe("AUTH_PROFILE_STALE");
  });

  it("uses bounded exponential delays for transient recovery", () => {
    expect(getAdminAuthRetryDelayMs(0)).toBe(ADMIN_AUTH_RETRY_BASE_MS);
    expect(getAdminAuthRetryDelayMs(1)).toBe(2_000);
    expect(getAdminAuthRetryDelayMs(4)).toBe(16_000);
    expect(getAdminAuthRetryDelayMs(5)).toBe(ADMIN_AUTH_RETRY_MAX_MS);
    expect(getAdminAuthRetryDelayMs(50)).toBe(ADMIN_AUTH_RETRY_MAX_MS);
  });
});

describe("admin proactive refresh timing", () => {
  it("uses deadline-bound expiry for short TTLs and an adaptive lead from 60 seconds", () => {
    expect(getAdminRefreshLeadMs(20)).toBe(0);
    expect(getAdminRefreshLeadMs(1)).toBe(0);
    expect(getAdminRefreshLeadMs(5)).toBe(0);
    expect(getAdminRefreshLeadMs(59)).toBe(0);
    expect(getAdminRefreshLeadMs(60)).toBe(12_000);
    expect(getAdminRefreshLeadMs(600)).toBe(60_000);
    expect(getAdminRefreshLeadMs(3_600)).toBe(60_000);

    expect(getAdminRefreshDelayMs({ savedAt: 0, expiresIn: 60 }, 0)).toBe(
      48_000,
    );
    expect(getAdminRefreshDelayMs({ savedAt: 0, expiresIn: 600 }, 0)).toBe(
      540_000,
    );
    expect(getAdminRefreshDelayMs({ savedAt: 0, expiresIn: 1 }, 0)).toBe(1_000);
    expect(getAdminRefreshDelayMs({ savedAt: 0, expiresIn: 5 }, 0, 5_000)).toBe(
      5_000,
    );
  });

  it("moves refresh earlier by bounded jitter and reports when it is due", () => {
    const timing = { savedAt: 0, expiresIn: 60 };
    expect(
      getAdminRefreshDelayMs(
        timing,
        0,
        ADMIN_REFRESH_MAX_EARLY_JITTER_MS,
      ),
    ).toBe(43_000);
    expect(isAdminRefreshDue(timing, 42_999, 5_000)).toBe(false);
    expect(isAdminRefreshDue(timing, 43_000, 5_000)).toBe(true);
  });

  it("caps oversized jitter at a fixed positive first delay", () => {
    const timing = { savedAt: 0, expiresIn: 60 };
    expect(getAdminRefreshDelayMs(timing, 0, 100_000)).toBe(1);
    expect(getAdminRefreshDelayMs(timing, 0.5, 100_000)).toBe(0.5);
    expect(getAdminRefreshDelayMs(timing, 1, 100_000)).toBe(0);
  });

  it("treats invalid timing as immediately due", () => {
    expect(isAdminRefreshDue(null, 0)).toBe(true);
    expect(
      isAdminRefreshDue({ savedAt: Number.NaN, expiresIn: 600 }, 0),
    ).toBe(true);
    expect(getAdminRefreshDelayMs({ savedAt: 0, expiresIn: 0 }, 0)).toBe(0);
  });
});

describe("admin proactive refresh scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeds timing immediately when metadata is missing and re-arms after success", async () => {
    let timing: RefreshScheduleTiming | null = null;
    const refresh = vi.fn(async () => {
      timing = { savedAt: Date.now(), expiresIn: 60 };
    });
    const onTerminal = vi.fn();
    const scheduler = startAdminSessionRefreshScheduler({
      getTiming: () => timing,
      refresh,
      onTerminal,
      random: () => 0,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(47_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(onTerminal).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it.each([1, 5])(
    "schedules a successful %s-second deadline-bound TTL at expiry even with maximum jitter",
    async (expiresIn) => {
      let timing: RefreshScheduleTiming | null = null;
      const refresh = vi.fn(async () => {
        timing = { savedAt: Date.now(), expiresIn };
      });
      const scheduler = startAdminSessionRefreshScheduler({
        getTiming: () => timing,
        refresh,
        onTerminal: vi.fn(),
        random: () => 1,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(expiresIn * 1_000 - 1);
      expect(refresh).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(refresh).toHaveBeenCalledTimes(2);

      scheduler.stop();
    },
  );

  it("uses bounded exponential retry for transient failures", async () => {
    let timing: RefreshScheduleTiming | null = null;
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("gateway unavailable"), { status: 503 }),
      )
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockImplementationOnce(async () => {
        timing = { savedAt: Date.now(), expiresIn: 600 };
      });
    const onTerminal = vi.fn();
    const scheduler = startAdminSessionRefreshScheduler({
      getTiming: () => timing,
      refresh,
      onTerminal,
      random: () => 0,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_BASE_MS - 1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(onTerminal).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("stops only for an explicit session-ending 401", async () => {
    const terminalError = {
      response: {
        status: 401,
        data: { code: "AUTH_SESSION_IDLE_EXPIRED" },
      },
    };
    const refresh = vi.fn(async () => {
      throw terminalError;
    });
    const onTerminal = vi.fn();
    startAdminSessionRefreshScheduler({
      getTiming: () => null,
      refresh,
      onTerminal,
      random: () => 0,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledWith(terminalError);
    await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_MAX_MS);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("retains and retries an unclassified 401 instead of ending the session", async () => {
    let timing: RefreshScheduleTiming | null = null;
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce({
        response: { status: 401, data: { code: "COMMON.AUTH.MISSING_TOKEN" } },
      })
      .mockImplementationOnce(async () => {
        timing = { savedAt: Date.now(), expiresIn: 600 };
      });
    const onTerminal = vi.fn();
    const scheduler = startAdminSessionRefreshScheduler({
      getTiming: () => timing,
      refresh,
      onTerminal,
      random: () => 0,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(onTerminal).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_BASE_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(onTerminal).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("keeps the missing-timing retry when reschedule is requested during refresh", async () => {
    const refresh = vi.fn(async () => {
      scheduler.reschedule();
    });
    const scheduler: ReturnType<typeof startAdminSessionRefreshScheduler> =
      startAdminSessionRefreshScheduler({
        getTiming: () => null,
        refresh,
        onTerminal: vi.fn(),
        random: () => 0,
      });

    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_BASE_MS - 1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("preserves transient backoff across repeated wake and reschedule calls", async () => {
    const refresh = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });
    const scheduler = startAdminSessionRefreshScheduler({
      getTiming: () => null,
      refresh,
      onTerminal: vi.fn(),
      random: () => 0,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.wake();
    scheduler.reschedule();
    scheduler.wake();
    await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_BASE_MS - 1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.wake();
    scheduler.reschedule();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(3);

    scheduler.stop();
  });

  it("skips an armed timer when a newer timing fingerprint appears", async () => {
    let timing: RefreshScheduleTiming | null = {
      savedAt: 0,
      expiresIn: 60,
    };
    const refresh = vi.fn(async () => {
      timing = { savedAt: Date.now(), expiresIn: 60 };
    });
    const scheduler = startAdminSessionRefreshScheduler({
      getTiming: () => timing,
      refresh,
      onTerminal: vi.fn(),
      random: () => 0,
    });

    await vi.advanceTimersByTimeAsync(40_000);
    timing = { savedAt: 10_000, expiresIn: 60 };
    await vi.advanceTimersByTimeAsync(8_000);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledOnce();

    scheduler.stop();
  });

  it("reschedules from newer timing, wakes overdue sessions, and stops cleanly", async () => {
    let timing: RefreshScheduleTiming | null = {
      savedAt: Date.now(),
      expiresIn: 600,
    };
    const refresh = vi.fn(async () => {
      timing = { savedAt: Date.now(), expiresIn: 600 };
    });
    const scheduler = startAdminSessionRefreshScheduler({
      getTiming: () => timing,
      refresh,
      onTerminal: vi.fn(),
      random: () => 0,
    });

    await vi.advanceTimersByTimeAsync(100_000);
    timing = { savedAt: Date.now(), expiresIn: 600 };
    scheduler.reschedule();
    await vi.advanceTimersByTimeAsync(440_000);
    expect(refresh).not.toHaveBeenCalled();

    timing = { savedAt: 0, expiresIn: 60 };
    scheduler.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledOnce();

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_MAX_MS * 20);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
