"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { getAuthErrorCode } from "@/lib/auth/sessionRefresh";
import { isValidEmailAddress } from "@/shared/validation/email";

export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [forgotFieldError, setForgotFieldError] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    target: "email" | "password" | "summary" | "submission" | "forgot-field" | "forgot-submission";
  } | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);
  const forgotEmailInputRef = useRef<HTMLInputElement>(null);
  const forgotErrorRef = useRef<HTMLDivElement>(null);

  const { t, lang } = useI18n();
  const copy = (lang === "ar" ? ar : en).login;
  const { login } = useAuth();
  const toast = useToast();

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleRememberMe = () => setRememberMe((prev) => !prev);

  useEffect(() => {
    if (!focusRequest) return;
    const target = {
      email: emailInputRef.current,
      password: passwordInputRef.current,
      summary: errorSummaryRef.current,
      submission: submissionErrorRef.current,
      "forgot-field": forgotEmailInputRef.current,
      "forgot-submission": forgotErrorRef.current,
    }[focusRequest.target];
    target?.focus();
  }, [focusRequest, fieldErrors, error, forgotFieldError, forgotError]);

  const updateEmail = (value: string) => {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setForgotFieldError(null);
    setForgotError(null);
    setError(null);
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const nextFieldErrors = {
      ...(!trimmedEmail
        ? { email: copy.emailRequiredMessage }
        : !isValidEmailAddress(trimmedEmail)
          ? { email: copy.emailInvalidMessage }
          : {}),
      ...(!password ? { password: copy.passwordRequiredMessage } : {}),
    };
    setFieldErrors(nextFieldErrors);
    const invalidFields = Object.keys(nextFieldErrors);
    if (invalidFields.length > 0) {
      setFocusRequest({
        target: invalidFields.length > 1
          ? "summary"
          : invalidFields[0] === "email"
            ? "email"
            : "password",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email: trimmedEmail, password, rememberMe });
      toast.success(copy.loginSuccessTitle, copy.loginSuccessDescription);
    } catch (err: unknown) {
      // A newer login in another tab owns the shared cookie session. AuthContext
      // adopts it through the session event/bootstrap path without presenting
      // the superseded local submission as a credential failure.
      if (getAuthErrorCode(err) === "AUTH_SESSION_CHANGED") return;
      const errorPayload = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = errorPayload?.response?.data?.message || errorPayload?.message || copy.credentialsInvalidFallback;
      setError(errMsg);
      setFocusRequest({ target: "submission" });
      toast.error(copy.authenticationErrorTitle, errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotFieldError(null);
    setForgotError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setForgotFieldError(copy.emailRequiredMessage);
      setFocusRequest({ target: "forgot-field" });
      return;
    }
    if (!isValidEmailAddress(trimmedEmail)) {
      setForgotFieldError(copy.emailInvalidMessage);
      setFocusRequest({ target: "forgot-field" });
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosClient.post(
        "/api/admin/core/v1/auth/forgot-password",
        { email: trimmedEmail },
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
      setForgotError(copy.sendFailedDescription);
      setFocusRequest({ target: "forgot-submission" });
      toast.error(copy.sendFailedTitle, copy.sendFailedDescription);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    email,
    setEmail: updateEmail,
    password,
    setPassword: updatePassword,
    rememberMe,
    showPassword,
    isSubmitting,
    error,
    fieldErrors,
    forgotFieldError,
    forgotError,
    emailInputRef,
    passwordInputRef,
    errorSummaryRef,
    submissionErrorRef,
    forgotEmailInputRef,
    forgotErrorRef,
    isForgotModalOpen,
    setIsForgotModalOpen,
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  };
}
