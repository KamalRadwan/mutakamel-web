"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";

export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
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
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || (lang === "ar" ? "بيانات الاعتماد غير صالحة" : "Invalid email or password");
      setError(errMsg);
      toast.error(lang === "ar" ? "خطأ في الدخول" : "Authentication Error", errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotSent(true);
    setTimeout(() => {
      setIsForgotModalOpen(false);
      setForgotSent(false);
      toast.info(
        lang === "ar" ? "تم إرسال رابط التعيين" : "Reset Link Sent",
        lang === "ar" ? "راجع بريدك الإلكتروني لإعادة ضبط كلمة المرور." : "Check your inbox for password reset instructions."
      );
    }, 1500);
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
    forgotSent,
    setIsForgotModalOpen,
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  };
}
