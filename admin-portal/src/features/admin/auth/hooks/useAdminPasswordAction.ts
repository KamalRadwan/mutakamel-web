"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAuthErrorCode, getAuthErrorStatus } from "@/lib/auth/sessionRefresh";
import {
  getAdminPasswordChecks,
  readAdminActionTokenFromHash,
  validateAdminPasswordAction,
  type AdminPasswordValidationError,
} from "../lib/admin-password-policy";

export type AdminPasswordActionMode = "acceptInvite" | "resetPassword";
export type AdminPasswordActionError =
  | AdminPasswordValidationError
  | "invalidOrExpiredToken"
  | "rateLimited"
  | "sessionChanged"
  | "unavailable";

export function useAdminPasswordAction(mode: AdminPasswordActionMode) {
  const { acceptInvite, resetPassword } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<AdminPasswordActionError | null>(null);

  useEffect(() => {
    const actionToken = readAdminActionTokenFromHash(window.location.hash);
    let cancelled = false;

    // Keep one-time credentials out of copied URLs, screenshots, and later
    // browser navigation without persisting them anywhere else.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setToken(actionToken);
      setIsTokenReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const passwordChecks = useMemo(
    () => getAdminPasswordChecks(password),
    [password],
  );

  const submit = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isSubmitting) return;

    const validationError = validateAdminPasswordAction({
      token,
      password,
      confirmation,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const input = { token: token as string, newPassword: password };
      if (mode === "acceptInvite") {
        await acceptInvite(input);
      } else {
        await resetPassword(input);
      }
    } catch (caught) {
      const code = getAuthErrorCode(caught);
      const status = getAuthErrorStatus(caught);
      if (code === "INVALID_ACTION_TOKEN") {
        setError("invalidOrExpiredToken");
      } else if (code === "WEAK_PASSWORD") {
        setError("passwordWeak");
      } else if (code === "AUTH_SESSION_CHANGED") {
        setError("sessionChanged");
      } else if (status === 429) {
        setError("rateLimited");
      } else {
        setError("unavailable");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [acceptInvite, confirmation, isSubmitting, mode, password, resetPassword, token]);

  return {
    token,
    isTokenReady,
    password,
    setPassword,
    confirmation,
    setConfirmation,
    showPassword,
    toggleShowPassword: () => setShowPassword((current) => !current),
    passwordChecks,
    isSubmitting,
    error,
    submit,
  };
}
