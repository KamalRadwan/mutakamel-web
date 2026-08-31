"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { classifyApiOutcome } from "@/lib/api/outcomes";

/**
 * The distinguishable ways a sign-in attempt fails.
 *
 * Every branch is a status + `errorCode` pair read from core-app source, never
 * from message text:
 *
 *   401 INVALID_CREDENTIALS   tenant-auth.service.ts — wrong address or password
 *   403 ACCOUNT_NOT_ACTIVE    the tenant user is INVITED, SUSPENDED or DEACTIVATED
 *   403 SUBSCRIPTION_PAST_DUE assertSubscriptionAllowsLogin
 *   503 TENANT_INACTIVE       fqdn-tenant-resolver.guard.ts — the workspace itself
 *   429                       the Gateway rate limiter (GW.RATE.LIMIT_EXCEEDED)
 *   status 0                  no HTTP response reached the browser at all
 *
 * They needed four different next actions from the user and produced one
 * identical toast (defect L2, `login/hooks/useLogin.ts:41`).
 */
export type LoginFailureKind =
  | "invalidCredentials"
  | "accountNotActive"
  | "subscriptionPastDue"
  | "tenantInactive"
  | "rateLimited"
  | "offline"
  | "unknown";

export function classifyLoginFailure(error: NormalizedApiError): LoginFailureKind {
  if (classifyApiOutcome(error) === "rateLimited") return "rateLimited";
  if (error.status === 0) return "offline";
  if (error.code === "INVALID_CREDENTIALS") return "invalidCredentials";
  if (error.code === "ACCOUNT_NOT_ACTIVE") return "accountNotActive";
  if (error.code === "SUBSCRIPTION_PAST_DUE") return "subscriptionPastDue";
  if (error.code === "TENANT_INACTIVE") return "tenantInactive";
  if (error.status === 401) return "invalidCredentials";
  return "unknown";
}

export function useLogin() {
  const { t } = useI18n();
  const toast = useToast();
  const { login } = useTenantAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  // D1 (docs/build/DEFECTS.md#d1): the reset dialog previously had no bound
  // state at all, so whatever the user typed there was discarded and the
  // request went out with the login field's value instead.
  const [resetEmail, setResetEmail] = useState("");
  // 4.31: the failure renders in the form, where the field that caused it is.
  // A toast for a sign-in failure disappears before the user has read it and
  // cannot host the "contact your administrator" next step.
  const [failure, setFailure] = useState<NormalizedApiError | null>(null);

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleRememberMe = () => setRememberMe((prev) => !prev);

  const openForgotModal = () => {
    setResetEmail("");
    setIsForgotModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFailure(null);
    try {
      await login({ email, password, rememberMe });
      toast.success(t.auth.signInSuccess, t.auth.signInSuccessMessage);
    } catch (error) {
      setFailure(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosClient.post(
        "/api/tenant/core/v1/auth/forgot-password",
        { email: resetEmail },
        { skipAuthRefresh: true, skipAutoIdempotency: true },
      );
      toast.info(t.auth.resetLinkSent, t.auth.resetLinkSentMessage);
      setIsForgotModalOpen(false);
    } catch {
      toast.error(t.auth.resetFailed, t.auth.resetFailedMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    showPassword,
    isSubmitting,
    isForgotModalOpen,
    setIsForgotModalOpen,
    openForgotModal,
    resetEmail,
    setResetEmail,
    failure,
    failureKind: failure ? classifyLoginFailure(failure) : null,
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  };
}
