import type { WebphoneMediaNoticeCode, WebphoneStatusCode } from "./types";

export type WebphoneLanguage = "ar" | "en";

/**
 * Every user-facing string the widget renders, resolved to one language.
 * The SIP layer and the API emit codes only; this is the presentation layer
 * that maps them to text, and the portal chooses which dictionary to inject.
 */
export type WebphoneCopy = {
  /** Fallback name shown when the extension carries no display name. */
  phoneName: string;
  phoneRegion: string;
  phoneSections: string;
  phone: string;
  calls: string;
  registered: string;
  connecting: string;
  error: string;
  offline: string;
  ready: string;
  enterNumber: string;
  copyNumber: string;
  deleteDigit: string;
  incoming: string;
  unknownCaller: string;
  dismissAlert: string;
  connected: string;
  answer: string;
  decline: string;
  call: string;
  hangup: string;
  hold: string;
  resume: string;
  mic: string;
  speaker: string;
  muteMic: string;
  unmuteMic: string;
  muteSpeaker: string;
  unmuteSpeaker: string;
  autoAnswer: string;
  dnd: string;
  loading: string;
  noCalls: string;
  unknown: string;
  showPhone: string;
  foldPhone: string;
  retryConnection: string;
  status: Record<WebphoneStatusCode, string>;
  mediaNoticeText: Record<WebphoneMediaNoticeCode, string>;
};

export const webphoneCopy: Record<WebphoneLanguage, WebphoneCopy> = {
  ar: {
    phoneName: "الهاتف",
    phoneRegion: "هاتف WebRTC",
    phoneSections: "أقسام الهاتف",
    phone: "الهاتف",
    calls: "السجل",
    registered: "مسجل",
    connecting: "جارٍ الاتصال",
    error: "خطأ",
    offline: "غير متصل",
    ready: "جاهز",
    enterNumber: "أدخل الرقم...",
    copyNumber: "نسخ الرقم",
    deleteDigit: "حذف آخر رقم",
    incoming: "مكالمة واردة",
    unknownCaller: "متصل غير معروف",
    dismissAlert: "إخفاء التنبيه",
    connected: "متصل",
    answer: "رد",
    decline: "رفض",
    call: "اتصال",
    hangup: "إنهاء",
    hold: "تعليق",
    resume: "استئناف",
    mic: "الميكروفون",
    speaker: "السماعة",
    muteMic: "كتم الميكروفون",
    unmuteMic: "تشغيل الميكروفون",
    muteSpeaker: "كتم السماعة",
    unmuteSpeaker: "تشغيل السماعة",
    autoAnswer: "رد تلقائي",
    dnd: "عدم الإزعاج",
    loading: "جارٍ تحميل سجل المكالمات",
    noCalls: "لا توجد مكالمات مسجلة",
    unknown: "غير معروف",
    showPhone: "فتح هاتف WebRTC",
    foldPhone: "تصغير هاتف WebRTC",
    retryConnection: "إعادة محاولة الاتصال",
    status: {
      idle: "خامل",
      loadingPhone: "جارٍ تحميل الهاتف",
      disabled: "معطل",
      ready: "جاهز",
      notConfigured: "غير مُهيأ",
      unavailable: "غير متاح",
      connecting: "جارٍ الاتصال",
      socketConnected: "تم الاتصال بالخادم",
      registering: "جارٍ التسجيل",
      registered: "تم التسجيل",
      registrationFailed: "فشل التسجيل",
      disconnected: "انقطع الاتصال",
      connectFailed: "فشل الاتصال",
      incomingCall: "مكالمة واردة",
      calling: "جارٍ الاتصال بالرقم",
      ringing: "يرن الآن",
      startingCall: "جارٍ بدء المكالمة",
      callEnded: "انتهت المكالمة",
      declined: "تم الرفض",
      callFailed: "فشلت المكالمة",
      inCall: "في مكالمة",
    },
    mediaNoticeText: {
      requiresHttps: "يتطلب الميكروفون اتصال HTTPS آمن",
      unavailable: "الميكروفون غير متاح",
      stopped: "توقف الميكروفون",
      muted: "تم كتم الميكروفون",
      clickToAllow: "انقر للسماح بالصوت",
      permissionDenied: "تم رفض إذن الميكروفون",
    },
  },
  en: {
    phoneName: "Phone",
    phoneRegion: "WebRTC phone",
    phoneSections: "Phone sections",
    phone: "Phone",
    calls: "Call log",
    registered: "Registered",
    connecting: "Connecting",
    error: "Error",
    offline: "Offline",
    ready: "Ready",
    enterNumber: "Enter number...",
    copyNumber: "Copy number",
    deleteDigit: "Delete last digit",
    incoming: "Incoming call",
    unknownCaller: "Unknown caller",
    dismissAlert: "Dismiss alert",
    connected: "Connected",
    answer: "Answer",
    decline: "Decline",
    call: "Call",
    hangup: "Hang up",
    hold: "Hold",
    resume: "Resume",
    mic: "Microphone",
    speaker: "Speaker",
    muteMic: "Mute microphone",
    unmuteMic: "Unmute microphone",
    muteSpeaker: "Mute speaker",
    unmuteSpeaker: "Unmute speaker",
    autoAnswer: "Auto answer",
    dnd: "Do not disturb",
    loading: "Loading call history",
    noCalls: "No calls recorded",
    unknown: "Unknown",
    showPhone: "Open WebRTC phone",
    foldPhone: "Collapse WebRTC phone",
    retryConnection: "Retry connection",
    status: {
      idle: "Idle",
      loadingPhone: "Loading phone",
      disabled: "Disabled",
      ready: "Ready",
      notConfigured: "Not configured",
      unavailable: "Unavailable",
      connecting: "Connecting",
      socketConnected: "Socket connected",
      registering: "Registering",
      registered: "Registered",
      registrationFailed: "Registration failed",
      disconnected: "Disconnected",
      connectFailed: "Connect failed",
      incomingCall: "Incoming call",
      calling: "Calling",
      ringing: "Ringing",
      startingCall: "Starting call",
      callEnded: "Call ended",
      declined: "Declined",
      callFailed: "Call failed",
      inCall: "In call",
    },
    mediaNoticeText: {
      requiresHttps: "Microphone requires HTTPS",
      unavailable: "Microphone unavailable",
      stopped: "Microphone stopped",
      muted: "Microphone muted",
      clickToAllow: "Click to allow audio",
      permissionDenied: "Microphone permission denied",
    },
  },
};
