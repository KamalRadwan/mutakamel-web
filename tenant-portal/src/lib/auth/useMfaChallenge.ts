"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { readMfaFailure, resendMfa, type MfaErrorKind, type MfaStep } from "./mfaApi";

interface ActiveStep extends MfaStep { expiresAt: number; resendAt: number }

export function useMfaChallenge(
  verify: (challengeId: string, code: string) => Promise<unknown>,
  settings = false,
) {
  const [step, setStep] = useState<ActiveStep | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<MfaErrorKind | "expired" | "codeFormat" | null>(null);
  const [busy, setBusy] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [now, setNow] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!step && !blockedUntil) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      setBlockedUntil((deadline) => deadline > 0 && deadline <= time ? 0 : deadline);
    }, 1000);
    return () => clearInterval(timer);
  }, [step, blockedUntil]);

  const start = (value: MfaStep) => {
    const time = Date.now();
    setNow(time);
    setStep({ ...value, expiresAt: time + value.expiresIn * 1000,
      resendAt: time + value.resendAfterSeconds * 1000 });
    setCode("");
    setError(null);
    setRestartRequired(false);
    // A replacement flow does not reset any existing server budget.
  };

  const reset = () => {
    if (inFlight.current) return;
    setStep(null);
    setCode("");
    setError(null);
    setRestartRequired(false);
  };

  const handleFailure = (caught: unknown, confirming: boolean) => {
    const failure = readMfaFailure(caught);
    setError(failure.kind);
    if (failure.retrySeconds) {
      setNow(Date.now());
      setBlockedUntil(Date.now() + failure.retrySeconds * 1000);
    }
    // A lost confirmation may already have consumed the code. Never submit it again.
    if (confirming && failure.kind === "ambiguous") setRestartRequired(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!step || inFlight.current || restartRequired || Date.now() < blockedUntil) return;
    if (Date.now() >= step.expiresAt) { setError("expired"); return; }
    if (!/^[0-9]{6}$/u.test(code)) { setError("codeFormat"); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await verify(step.challengeId, code);
    } catch (caught) {
      handleFailure(caught, true);
    } finally {
      setCode("");
      inFlight.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!step || inFlight.current || restartRequired ||
        Date.now() < Math.max(step.resendAt, blockedUntil) || Date.now() >= step.expiresAt) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setCode("");
    try {
      const updated = await resendMfa(step.challengeId, settings);
      if (updated.challengeId !== step.challengeId) throw new Error("INVALID_MFA_RESPONSE");
      const time = Date.now();
      setNow(time);
      setStep({ ...updated, expiresAt: Math.min(step.expiresAt, time + updated.expiresIn * 1000),
        resendAt: time + updated.resendAfterSeconds * 1000 });
    } catch (caught) {
      handleFailure(caught, false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const expired = Boolean(step && now >= step.expiresAt);
  return { step, code, setCode, error: expired ? "expired" as const : error,
    busy, start, reset, submit, resend, restartRequired,
    reportFailure: (caught: unknown) => handleFailure(caught, false),
    expired, blocked: now < blockedUntil,
    retrySeconds: Math.max(0, Math.ceil((blockedUntil - now) / 1000)),
    resendSeconds: step ? Math.max(0, Math.ceil((Math.max(step.resendAt, blockedUntil) - now) / 1000)) : 0 };
}
