"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";

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

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleRememberMe = () => setRememberMe((prev) => !prev);

  const openForgotModal = () => {
    setResetEmail("");
    setIsForgotModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login({ email, password, rememberMe });
      toast.success(t.auth.signInSuccess, t.auth.signInSuccessMessage);
    } catch (error) {
      const normalized = normalizeApiError(error);
      toast.error(t.auth.signInFailed, normalized.message ?? t.auth.invalidCredentials);
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
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  };
}
