"use client";

import { useEffect, useRef, useState } from "react";
import { DATE_TIME_OPTIONS, useCan } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  readSuppressionLift,
  readSuppressionLookup,
  type EmailSuppressionAddress,
  type EmailSuppressionLookup,
} from "../email-suppression-contract";

const PATHS = {
  lookup: "/api/tenant/core/v1/email-suppressions/lookup",
  lift: "/api/tenant/core/v1/email-suppressions/lift",
} as const;

export type EmailSuppressionNoticeKind = "lifted" | "alreadyAbsent";

export function useEmailSuppression(onOverlayChange?: (open: boolean) => void) {
  const { t } = useI18n();
  const copy = t.emailSuppression;
  const canManage = useCan("workspace.email.manage", { tenantWide: true });
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<EmailSuppressionLookup | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirmingState] = useState(false);
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [error, setError] = useState<keyof typeof copy.errors | null>(null);
  const [notice, setNotice] = useState<EmailSuppressionNoticeKind | null>(null);
  const [denied, setDenied] = useState(false);
  const active = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);
  const intent = useRef<{ address: string; key: string } | null>(null);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      active.current?.abort();
      active.current = null;
      intent.current = null;
    };
  }, []);

  useEffect(() => {
    if (canManage) return;
    if (
      active.current !== null ||
      address.length > 0 ||
      result !== null ||
      notice !== null ||
      confirming ||
      isLookupModalOpen ||
      error !== null
    ) {
      active.current?.abort();
      active.current = null;
      intent.current = null;
      setPending(false);
      setConfirmingState(false);
      setIsLookupModalOpen(false);
      setResult(null);
      setNotice(null);
      setError(null);
      setAddress("");
    }
  }, [canManage, address, result, notice, confirming, isLookupModalOpen, error]);

  const hasOverlay = isLookupModalOpen || confirming;
  useEffect(() => {
    onOverlayChange?.(hasOverlay);
    return () => {
      onOverlayChange?.(false);
    };
  }, [onOverlayChange, hasOverlay]);

  const updateAddress = (value: string) => {
    if (disposedRef.current || active.current || !canManage || denied) return;
    setAddress(value);
    setResult(null);
    setError(null);
    setNotice(null);
    setConfirmingState(false);
    setIsLookupModalOpen(false);
    intent.current = null;
  };

  const setConfirming = (next: boolean) => {
    if (disposedRef.current || active.current) return;
    if (next && (!canManage || denied || !result?.suppressed)) return;
    setError(null);
    setConfirmingState(next);
  };

  const closeLookupModal = () => {
    if (disposedRef.current || active.current) return;
    setIsLookupModalOpen(false);
    setError(null);
  };

  const run = async (action: "lookup" | "lift") => {
    if (
      disposedRef.current ||
      active.current ||
      !canManage ||
      denied ||
      (action === "lift" && (!confirming || !result?.suppressed))
    ) {
      return;
    }
    const entered = address.trim();
    if (!entered || entered.length > 320) {
      setError("invalidAddress");
      if (action === "lookup") setIsLookupModalOpen(false);
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError(null);
    setNotice(null);
    if (action === "lookup") {
      setConfirmingState(false);
      setResult(null);
      setIsLookupModalOpen(true);
    }
    const body: EmailSuppressionAddress = { address: entered };
    try {
      if (action === "lift" && intent.current?.address !== entered) {
        intent.current = { address: entered, key: generateUUIDv7() };
      }
      const response = await axiosClient.post<unknown>(PATHS[action], body, {
        cache: "no-store",
        signal: controller.signal,
        skipAutoIdempotency: true,
        ...(action === "lift" ? { headers: { "x-idempotency-key": intent.current!.key } } : {}),
      });
      if (disposedRef.current || controller.signal.aborted || active.current !== controller) return;
      if (action === "lookup") {
        setResult(readSuppressionLookup(response.data));
        intent.current = null;
        setIsLookupModalOpen(true);
      } else {
        const lifted = readSuppressionLift(response.data);
        intent.current = null;
        setConfirmingState(false);
        setResult({ suppressed: false });
        setNotice(lifted.lifted ? "lifted" : "alreadyAbsent");
        setIsLookupModalOpen(true);
      }
    } catch (caught) {
      if (disposedRef.current || controller.signal.aborted || active.current !== controller) return;
      const normalized = normalizeApiError(caught);
      const status = normalized.status;
      if (status === 403) {
        setDenied(true);
        setConfirmingState(false);
        setIsLookupModalOpen(false);
        setResult(null);
        setNotice(null);
        setAddress("");
        intent.current = null;
      } else if (action === "lookup" && (status === 400 || status === 422)) {
        setIsLookupModalOpen(false);
      }
      // Never render server text: validation errors can contain the submitted address.
      setError(
        status === 403
          ? "forbidden"
          : status === 400 || status === 422
            ? "invalidAddress"
            : status === 429
              ? "rateLimited"
              : "failed",
      );
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (!disposedRef.current) {
          setPending(false);
        }
      }
    }
  };

  const date = (value: string) =>
    new Intl.DateTimeFormat(copy.numberLocale, DATE_TIME_OPTIONS.datetime).format(new Date(value));

  return {
    copy,
    canManage,
    address,
    updateAddress,
    result,
    pending,
    confirming,
    setConfirming,
    isLookupModalOpen,
    closeLookupModal,
    error: error ? copy.errors[error] : undefined,
    notice: notice ? copy[notice] : null,
    noticeKind: notice,
    denied,
    date,
    lookup: () => run("lookup"),
    lift: () => run("lift"),
  };
}
