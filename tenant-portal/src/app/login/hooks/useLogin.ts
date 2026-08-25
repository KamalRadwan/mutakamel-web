"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";

export function useLogin() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { login } = useTenantAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleRememberMe = () => setRememberMe((prev) => !prev);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login({ email, password, rememberMe });
      toast.success(
        lang === "ar" ? "تم تسجيل الدخول" : "Signed in",
        lang === "ar" ? "تم التحقق من الجلسة بنجاح." : "Your session was verified successfully.",
      );
    } catch (error) {
      const payload = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        lang === "ar" ? "فشل تسجيل الدخول" : "Sign-in failed",
        payload.response?.data?.message ??
          payload.message ??
          (lang === "ar" ? "بيانات الدخول غير صحيحة." : "Invalid credentials."),
      );
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
        { email },
        { skipAuthRefresh: true, skipAutoIdempotency: true },
      );
      toast.info(
        lang === "ar" ? "تم إرسال رابط إعادة التعيين" : "Reset Link Sent",
        lang === "ar"
          ? "إذا كان البريد مسجلاً، ستصل إليه تعليمات إعادة تعيين كلمة المرور."
          : "If the email is registered, password reset instructions will be sent.",
      );
      setIsForgotModalOpen(false);
    } catch {
      toast.error(
        lang === "ar" ? "تعذر الإرسال" : "Request failed",
        lang === "ar" ? "حاول مرة أخرى لاحقًا." : "Please try again later.",
      );
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
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  };
}
