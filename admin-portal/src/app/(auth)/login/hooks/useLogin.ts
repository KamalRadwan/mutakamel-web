"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { getAuthErrorCode } from "@/lib/auth/sessionRefresh";

export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const { t, lang } = useI18n();
  const copy = (lang === "ar" ? ar : en).login;
  const { login } = useAuth();
  const toast = useToast();

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleRememberMe = () => setRememberMe((prev) => !prev);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!email || !password) {
      const errMsg = copy.missingCredentialsError;
      setError(errMsg);
      toast.error(copy.loginFailedTitle, errMsg);
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email, password, rememberMe });
      toast.success(copy.loginSuccessTitle, copy.loginSuccessDescription);
    } catch (err: unknown) {
      // A newer login in another tab owns the shared cookie session. AuthContext
      // adopts it through the session event/bootstrap path without presenting
      // the superseded local submission as a credential failure.
      if (getAuthErrorCode(err) === "AUTH_SESSION_CHANGED") return;
      const errorPayload = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = errorPayload?.response?.data?.message || errorPayload?.message || copy.credentialsInvalidFallback;
      setError(errMsg);
      toast.error(copy.authenticationErrorTitle, errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      toast.error(copy.errorTitle, copy.emailRequiredMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosClient.post(
        "/api/admin/core/v1/auth/forgot-password",
        { email },
        {
          // This public enumeration-safe action is explicitly non-idempotent
          // in the Gateway contract; never attach a key or replay it.
          skipAutoIdempotency: true,
          nonReplayable: true,
        },
      );
      toast.info(copy.resetLinkSentTitle, copy.resetLinkSentDescription);
      setIsForgotModalOpen(false);
    } catch {
      toast.error(copy.sendFailedTitle, copy.sendFailedDescription);
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
    error,
    isForgotModalOpen,
    setIsForgotModalOpen,
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  };
}
