// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_EVENT_LIMIT,
  appendLiveRow,
  openLoggingEventSource,
  readLiveControlError,
  readLiveLogMessage,
  readLiveTimestamp,
  reconnectDelay,
} from "./live";
import { LOGGING_BASE_URL } from "./api";
import { TENANT_ID } from "./test-fixtures";
import type { RuntimeLogRow } from "./types";

describe("logging live stream helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens the canonical same-origin EventSource with credentials", () => {
    const constructor = vi.fn(function FakeEventSource() {
      return { close: vi.fn() };
    });
    vi.stubGlobal("EventSource", constructor);

    openLoggingEventSource({
      appName: "core-app",
      tenantId: TENANT_ID,
      minLevel: "error",
    });

    expect(constructor).toHaveBeenCalledWith(
      `${LOGGING_BASE_URL}/live?appName=core-app&tenantId=${TENANT_ID}&minLevel=error`,
      { withCredentials: true },
    );
  });

  it("reads log and control events from exact SSE JSON data", () => {
    const log = readLiveLogMessage(
      new MessageEvent("log", {
        data: JSON.stringify({
          timestamp: "2026-08-12T12:30:00.000Z",
          level: "warn",
          serviceName: "core-app",
          message: "Request delayed",
          correlationId: "corr-7",
        }),
      }),
      7,
    );
    expect(log).toMatchObject({ sequence: 7, level: "warn" });
    expect(
      readLiveTimestamp(
        new MessageEvent("heartbeat", {
          data: JSON.stringify({ timestamp: "2026-08-12T12:31:00.000Z" }),
        }),
      ),
    ).toBe("2026-08-12T12:31:00.000Z");
    expect(
      readLiveControlError(
        new MessageEvent("error", {
          data: JSON.stringify({
            code: "LOGGING_LIVE_REDIS_UNAVAILABLE",
            message: "Redis is required.",
          }),
        }),
      ),
    ).toEqual({
      code: "LOGGING_LIVE_REDIS_UNAVAILABLE",
      message: "Redis is required.",
    });
  });

  it("keeps only the last 200 projected events in memory", () => {
    let rows: RuntimeLogRow[] = [];
    for (let sequence = 1; sequence <= LIVE_EVENT_LIMIT + 5; sequence += 1) {
      rows = appendLiveRow(rows, {
        sequence,
        timestamp: "2026-08-12T12:30:00.000Z",
        level: "info",
        serviceName: "core-app",
        message: null,
        correlationId: null,
        tenantId: null,
      });
    }
    expect(rows).toHaveLength(LIVE_EVENT_LIMIT);
    expect(rows[0].sequence).toBe(6);
    expect(rows.at(-1)?.sequence).toBe(205);
  });

  it("uses bounded reconnect backoff", () => {
    expect([0, 1, 2, 3, 4, 99].map(reconnectDelay)).toEqual([
      1_000,
      2_000,
      5_000,
      10_000,
      30_000,
      30_000,
    ]);
  });
});
