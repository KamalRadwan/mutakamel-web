"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";

export type ActionTokenFlow = "accept-invite" | "reset-password";

/** Literal per flow — a Gateway path is never assembled from a variable. */
const FLOW_PATH: Record<ActionTokenFlow, string> = {
  "accept-invite": "/api/tenant/core/v1/auth/accept-invite",
  "reset-password": "/api/tenant/core/v1/auth/reset-password",
};

/** `AcceptInviteDto` / `ResetPasswordDto` — identical bounds on both. */
const ACTION_TOKEN_MIN_LENGTH = 16;
const ACTION_TOKEN_MAX_LENGTH = 512;
const NEW_PASSWORD_MIN_LENGTH = 12;
export const NEW_PASSWORD_MAX_LENGTH = 128;

/** `PASSWORD_POLICY` in core-app/src/common/security/password-policy.ts. */
export function meetsPasswordPolicy(value: string): boolean {
  return (
    value.length >= NEW_PASSWORD_MIN_LENGTH &&
    value.length <= NEW_PASSWORD_MAX_LENGTH &&
    /[a-z]/u.test(value) &&
    /[A-Z]/u.test(value) &&
    /\d/u.test(value) &&
    /[^A-Za-z0-9]/u.test(value)
  );
}

export type ActionTokenState =
  | "reading"
  | "missing-token"
  | "ready"
  | "submitting"
  | "rejected"
  | "succeeded";

/**
 * Reads the single-use token out of the URL **fragment**.
 *
 * `TenantPublicUrlService.buildTenantActionUrl` puts it there
 * (`url.hash = new URLSearchParams({ token })`), not in the query string, and
 * that is deliberate: a fragment never reaches a server, so the token cannot
 * land in an access log or a `Referer` header. This reads it once and then
 * clears it from the address bar, so a shared screenshot or a back-button
 * revisit does not carry a live credential.
 */
function readTokenFromFragment(): string | null {
  const hash = window.location.hash.replace(/^#/u, "");
  if (!hash) return null;
  const token = new URLSearchParams(hash).get("token");
  if (!token || token.length < ACTION_TOKEN_MIN_LENGTH || token.length > ACTION_TOKEN_MAX_LENGTH) {
    return null;
  }
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return token;
}

export function useActionTokenPassword(flow: ActionTokenFlow) {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<ActionTokenState>("reading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    // Deferred past the effect body: a synchronous setState there cascades an
    // extra render (react-hooks/set-state-in-effect). The fragment is still
    // read and cleared on the first tick after mount.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const found = readTokenFromFragment();
      setToken(found);
      setState(found ? "ready" : "missing-token");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    if (!token || !meetsPasswordPolicy(newPassword) || newPassword !== confirmPassword) return;
    setState("submitting");
    setError(null);
    try {
      await axiosClient.post(
        FLOW_PATH[flow],
        { token, newPassword },
        // A public action token is single-use: replaying it after a refresh
        // would consume a credential the first attempt may already have spent.
        { skipAuthRefresh: true, skipAutoIdempotency: true, nonReplayable: true },
      );
      setState("succeeded");
      setNewPassword("");
      setConfirmPassword("");
      // Accepting an invite issues a session; a reset deliberately does not, so
      // one lands in the workspace and the other on the sign-in form.
      router.replace(flow === "accept-invite" ? "/" : "/login");
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      setError(normalized);
      setState(normalized.status === 400 ? "rejected" : "ready");
    }
  }, [confirmPassword, flow, newPassword, router, token]);

  return {
    t,
    state,
    error,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    toggleShowPassword: () => setShowPassword((current) => !current),
    isPasswordValid: meetsPasswordPolicy(newPassword),
    isConfirmed: newPassword.length > 0 && newPassword === confirmPassword,
    submit,
  };
}
