import { liveLoggingUrl } from "./api";
import { readRuntimeLogEvent } from "./readers";
import type {
  LiveControlError,
  LiveLoggingQuery,
  RuntimeLogRow,
} from "./types";

export const LIVE_EVENT_LIMIT = 200;
export const LIVE_HEARTBEAT_STALE_MS = 35_000;
const LIVE_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

export function openLoggingEventSource(query: LiveLoggingQuery): EventSource {
  return new EventSource(liveLoggingUrl(query), { withCredentials: true });
}

export function readLiveLogMessage(
  event: Event,
  sequence: number,
): RuntimeLogRow {
  return readRuntimeLogEvent(readEventData(event), sequence);
}

export function readLiveControlError(event: Event): LiveControlError | null {
  if (!("data" in event) || typeof event.data !== "string") return null;
  try {
    const parsed = JSON.parse(event.data) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const code = (parsed as Record<string, unknown>).code;
    const message = (parsed as Record<string, unknown>).message;
    if (
      typeof code !== "string" ||
      !/^[A-Z][A-Z0-9_]{0,99}$/u.test(code) ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 500
    ) {
      return null;
    }
    return { code, message };
  } catch {
    return null;
  }
}

export function readLiveTimestamp(event: Event): string {
  const parsed = readEventData(event);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("INVALID_LIVE_CONTROL_EVENT");
  }
  const timestamp = (parsed as Record<string, unknown>).timestamp;
  if (typeof timestamp !== "string") throw new Error("INVALID_LIVE_CONTROL_EVENT");
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== timestamp) {
    throw new Error("INVALID_LIVE_CONTROL_EVENT");
  }
  return timestamp;
}

export function appendLiveRow(
  rows: readonly RuntimeLogRow[],
  row: RuntimeLogRow,
): RuntimeLogRow[] {
  return [...rows, row].slice(-LIVE_EVENT_LIMIT);
}

export function reconnectDelay(attempt: number): number {
  const index = Math.min(
    Math.max(0, attempt),
    LIVE_RECONNECT_DELAYS_MS.length - 1,
  );
  return LIVE_RECONNECT_DELAYS_MS[index];
}

function readEventData(event: Event): unknown {
  if (!("data" in event) || typeof event.data !== "string") {
    throw new Error("INVALID_LIVE_EVENT");
  }
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    throw new Error("INVALID_LIVE_EVENT");
  }
}
