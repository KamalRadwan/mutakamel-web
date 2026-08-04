"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";

export function useLogin() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [email, setEmail] = useState("admin@tenant.mutakamel.ai");
  const [password, setPassword] = useState("••••••••");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleRememberMe = () => setRememberMe((prev) => !prev);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      window.location.href = "/";
    }, 1000);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info(
      lang === "ar" ? "تم إرسال رابط إعادة التعيين" : "Reset Link Sent",
      lang === "ar"
        ? "إذا كان البريد مسجلاً، ستصل إليه تعليمات إعادة تعيين كلمة المرور."
        : "If the email is registered, password reset instructions will be sent.",
    );
    setIsForgotModalOpen(false);
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
