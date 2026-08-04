"use client";

import { useState, useEffect } from "react";
import { Volume2, Bell, Mic, CheckCircle2, ChevronRight, X, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function BrowserPermissionsModal() {
  const { lang } = useI18n();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<"speakers" | "notifications" | "mic" | "completed">("speakers");

  // Permission Granted States
  const [speakersGranted, setSpeakersGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);

  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check if permission modal was already completed in this session
    const hasCompleted = sessionStorage.getItem("browser_permissions_completed");
    if (hasCompleted) return;

    // Check initial browser permission states
    const checkPermissions = async () => {
      let needsPrompt = false;

      // 1. Notifications
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          setNotificationsGranted(true);
        } else {
          needsPrompt = true;
        }
      }

      // 2. Microphone
      if (typeof navigator !== "undefined" && navigator.permissions) {
        try {
          const micStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (micStatus.state === "granted") {
            setMicGranted(true);
          } else {
            needsPrompt = true;
          }
        } catch {
          needsPrompt = true;
        }
      }

      if (needsPrompt) {
        setIsOpen(true);
      }
    };

    checkPermissions();
  }, []);

  if (!isOpen || !isAuthenticated || pathname === "/login") return null;

  // Step 1: Request Speaker / Audio Access
  const requestSpeakerPermission = async () => {
    setIsRequesting(true);
    try {
      // Play a tiny silent/subtle audio tone to activate AudioContext
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        await ctx.resume();
      }
      setSpeakersGranted(true);
      setCurrentStep("notifications");
    } catch {
      setSpeakersGranted(true);
      setCurrentStep("notifications");
    } finally {
      setIsRequesting(false);
    }
  };

  // Step 2: Request Notifications Access
  const requestNotificationPermission = async () => {
    setIsRequesting(true);
    try {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setNotificationsGranted(true);
        }
      }
      setCurrentStep("mic");
    } catch {
      setCurrentStep("mic");
    } finally {
      setIsRequesting(false);
    }
  };

  // Step 3: Request Microphone Access
  const requestMicPermission = async () => {
    setIsRequesting(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop track immediately after acquiring permission
        stream.getTracks().forEach((track) => track.stop());
        setMicGranted(true);
      }
      finishPermissions();
    } catch {
      finishPermissions();
    } finally {
      setIsRequesting(false);
    }
  };

  const finishPermissions = () => {
    sessionStorage.setItem("browser_permissions_completed", "true");
    setCurrentStep("completed");
    setTimeout(() => {
      setIsOpen(false);
    }, 1500);
  };

  const skipAll = () => {
    sessionStorage.setItem("browser_permissions_completed", "true");
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">

        {/* Top Header & Skip */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4" />
            <span>{lang === "ar" ? "إعداد صلاحيات المتصفح" : "Browser Permissions Setup"}</span>
          </div>

          <button
            onClick={skipAll}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={lang === "ar" ? "تخطي" : "Skip"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Badges */}
        <div className="grid grid-cols-3 gap-2">
          {/* Step 1: Speakers */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
            speakersGranted
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300"
              : currentStep === "speakers"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20"
              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"
          }`}>
            <Volume2 className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-bold truncate">{lang === "ar" ? "السماعات" : "Speakers"}</span>
          </div>

          {/* Step 2: Notifications */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
            notificationsGranted
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300"
              : currentStep === "notifications"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20"
              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"
          }`}>
            <Bell className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-bold truncate">{lang === "ar" ? "الإشعارات" : "Alerts"}</span>
          </div>

          {/* Step 3: Mic */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
            micGranted
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300"
              : currentStep === "mic"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20"
              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"
          }`}>
            <Mic className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-bold truncate">{lang === "ar" ? "المايك" : "Mic"}</span>
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div className="space-y-4 py-2">

          {/* STEP 1: SPEAKERS */}
          {currentStep === "speakers" && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                  <Volume2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {lang === "ar" ? "الخطوة 1: السماح بالصوت والسماعات" : "Step 1: Allow Audio & Speaker Output"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === "ar" ? "تفعيل تشغيل نغمات رنين المكالمات الواردة والإشعارات." : "Enables WebRTC phone ringing and audio alert playback."}
                  </p>
                </div>
              </div>

              <button
                onClick={requestSpeakerPermission}
                disabled={isRequesting}
                className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{lang === "ar" ? "السماح بالصوت والسماعات" : "Allow Audio & Speakers"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: NOTIFICATIONS */}
          {currentStep === "notifications" && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {lang === "ar" ? "الخطوة 2: السماح بإشعارات المتصفح" : "Step 2: Allow Browser Notifications"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === "ar" ? "استلام تنبيهات المكالمات الواردة حتى عند تصغير المتصفح." : "Receive call alerts even when the browser is minimized."}
                  </p>
                </div>
              </div>

              <button
                onClick={requestNotificationPermission}
                disabled={isRequesting}
                className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{lang === "ar" ? "تفعيل إشعارات المتصفح" : "Enable Browser Notifications"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 3: MICROPHONE */}
          {currentStep === "mic" && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {lang === "ar" ? "الخطوة 3: السماح بالمايكروفون" : "Step 3: Allow Microphone Access"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === "ar" ? "مطلوب لإجراء وتلقي المكالمات الصوتية عبر الـ WebRTC." : "Required for 2-way WebRTC phone audio calling."}
                  </p>
                </div>
              </div>

              <button
                onClick={requestMicPermission}
                disabled={isRequesting}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{lang === "ar" ? "السماح بالمايكروفون" : "Grant Microphone Access"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* COMPLETED */}
          {currentStep === "completed" && (
            <div className="text-center py-4 space-y-2 animate-in zoom-in duration-300">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "تم ضبط الصلاحيات بنجاح!" : "Permissions Configured!"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "ar" ? "النظام جاهز الآن لإجراء المكالمات واستقبال التنبيهات." : "Your environment is ready for WebRTC calling and notifications."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
