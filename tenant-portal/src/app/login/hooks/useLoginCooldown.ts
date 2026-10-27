"use client";

import { useEffect, useState } from "react";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown> : undefined;
}

/** Core common/auth/login-lockout.policy.ts also serializes seconds as [string]. */
export function loginRetryAfterSeconds(error: unknown, now = Date.now()): number | null {
  const response = record(record(error)?.response);
  const data = record(response?.data);
  if (response?.status !== 429 ||
      (data?.errorCode ?? data?.code) !== "AUTH_LOGIN_THROTTLED") return null;

  const headers = response.headers;
  const header = headers instanceof Headers ? headers.get("Retry-After") : null;
  if (header) {
    const seconds = /^\d+$/u.test(header.trim())
      ? Number(header) : (Date.parse(header) - now) / 1000;
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  }
  const detail = record(data?.details)?.retryAfterSeconds;
  const value = Array.isArray(detail) ? detail[0] : detail;
  const seconds = typeof value === "number" ||
    (typeof value === "string" && /^\d+$/u.test(value)) ? Number(value) : NaN;
  // Missing/malformed metadata must not permit an immediate retry loop.
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

export function useLoginCooldown() {
  const [deadline, setDeadline] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (!remaining) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const startCooldown = (error: unknown) => {
    const seconds = loginRetryAfterSeconds(error);
    if (seconds !== null) {
      setDeadline(Date.now() + seconds * 1000);
      setRemainingSeconds(seconds);
    }
    return seconds;
  };
  return { startCooldown, isCoolingDown: remainingSeconds > 0,
    retryMinutes: Math.max(1, Math.ceil(remainingSeconds / 60)) };
}
