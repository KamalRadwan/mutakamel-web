"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
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
  const { login } = useAuth();
  const toast = useToast();

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleRememberMe = () => setRememberMe((prev) => !prev);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!email || !password) {
      const errMsg = lang === "ar" ? "يرجى أدخال البريد الإلكتروني وكلمة المرور" : "Please enter email and password";
      setError(errMsg);
      toast.error(lang === "ar" ? "فشل تسجيل الدخول" : "Login Failed", errMsg);
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email, password, rememberMe });
      toast.success(
        lang === "ar" ? "تم تسجيل الدخول بنجاح" : "Login Successful",
        lang === "ar" ? "أهلاً بك في منصة التحكم متكامل." : "Welcome to Mutakamel Control Plane."
      );
    } catch (err: unknown) {
      // A newer login in another tab owns the shared cookie session. AuthContext
      // adopts it through the session event/bootstrap path without presenting
      // the superseded local submission as a credential failure.
      if (getAuthErrorCode(err) === "AUTH_SESSION_CHANGED") return;
      const errorPayload = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = errorPayload?.response?.data?.message || errorPayload?.message || (lang === "ar" ? "بيانات الاعتماد غير صالحة" : "Invalid email or password");
      setError(errMsg);
      toast.error(lang === "ar" ? "خطأ في الدخول" : "Authentication Error", errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      toast.error(lang === "ar" ? "خطأ" : "Error", lang === "ar" ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email");
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
      toast.info(
        lang === "ar" ? "تم إرسال رابط التعيين" : "Reset Link Sent",
        lang === "ar"
          ? "إذا كان البريد مسجلاً، ستصل إليه تعليمات إعادة تعيين كلمة المرور."
          : "If the email is registered, password reset instructions will be sent."
      );
      setIsForgotModalOpen(false);
    } catch {
      toast.error(
        lang === "ar" ? "تعذر الإرسال" : "Failed to Send",
        lang === "ar" ? "حدث خطأ أثناء الاتصال بالخادم." : "Could not communicate with the server."
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
    error,
    isForgotModalOpen,
    setIsForgotModalOpen,
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  };
}
