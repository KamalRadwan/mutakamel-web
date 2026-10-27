"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { readSuppressionLift, readSuppressionLookup, type EmailSuppressionAddress, type EmailSuppressionLookup } from "../email-suppression-contract";

const ROOT = "/api/admin/core/v1/email-suppressions";

export function useEmailSuppression() {
  const { t } = useI18n();
  const copy = t.emailSuppression;
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<EmailSuppressionLookup | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<keyof typeof copy.errors | null>(null);
  const [notice, setNotice] = useState<"lifted" | "alreadyAbsent" | null>(null);
  const [denied, setDenied] = useState(false);
  const active = useRef<AbortController | null>(null);
  const intent = useRef<{ address: string; key: string } | null>(null);

  useEffect(() => () => {
    active.current?.abort();
    intent.current = null;
  }, []);

  const updateAddress = (value: string) => {
    if (active.current) return;
    setAddress(value);
    setResult(null);
    setError(null);
    setNotice(null);
    setConfirming(false);
    intent.current = null;
  };

  const run = async (action: "lookup" | "lift") => {
    if (active.current || denied || (action === "lift" && (!confirming || !result?.suppressed))) return;
    const entered = address.trim();
    if (!entered || entered.length > 320) {
      setError("invalidAddress");
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError(null);
    setNotice(null);
    setConfirming(false);
    if (action === "lookup") setResult(null);
    const body: EmailSuppressionAddress = { address: entered };
    try {
      if (action === "lift" && intent.current?.address !== entered) {
        intent.current = { address: entered, key: generateUUIDv7() };
      }
      const response = await axiosClient.post<unknown>(`${ROOT}/${action}`, body, {
        cache: "no-store",
        signal: controller.signal,
        skipAutoIdempotency: true,
        ...(action === "lift" ? { headers: { "x-idempotency-key": intent.current!.key } } : {}),
      });
      if (controller.signal.aborted) return;
      if (action === "lookup") {
        setResult(readSuppressionLookup(response.data));
        intent.current = null;
      } else {
        const lifted = readSuppressionLift(response.data);
        intent.current = null;
        setResult({ suppressed: false });
        setNotice(lifted.lifted ? "lifted" : "alreadyAbsent");
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      const normalized = normalizeApiError(caught);
      const status = normalized.httpStatus;
      if (status === 403) {
        setDenied(true);
        setResult(null);
        setAddress("");
        intent.current = null;
      }
      // Never render server text: validation errors can contain the submitted address.
      setError(status === 403 ? "forbidden" : status === 400 || status === 422 ? "invalidAddress" : status === 429 ? "rateLimited" : "failed");
    } finally {
      if (!controller.signal.aborted) {
        active.current = null;
        setPending(false);
      }
    }
  };

  const date = (value: string) => new Intl.DateTimeFormat(copy.numberLocale, {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));

  return { copy, address, updateAddress, result, pending, confirming, setConfirming,
    error: error ? copy.errors[error] : undefined, notice: notice ? copy[notice] : null,
    denied, date, lookup: () => run("lookup"), lift: () => run("lift") };
}

