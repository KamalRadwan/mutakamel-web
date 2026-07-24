"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Delete,
  ShieldCheck,
  PhoneForwarded,
  PhoneIncoming,
  X,
  UserCheck,
  UserPlus,
  ExternalLink
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { playDtmfTone } from "./utils/dtmfAudio";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function WebRTCPhoneWidget() {
  const { lang } = useI18n();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Hide phone widget completely on login page or when unauthenticated
  if (!isAuthenticated || pathname === "/login") {
    return null;
  }

  // Widget Expanded / Collapsed State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Call States
  const [isCalling, setIsCalling] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // Incoming Call State (null by default)
  const [incomingCall, setIncomingCall] = useState<{
    callerName: string;
    callerNumber: string;
    isExistingContact?: boolean;
    contactType?: "lead" | "customer";
    contactId?: string;
  } | null>(null);

  const [isPopupDismissed, setIsPopupDismissed] = useState(false);

  // Transfer Dialog State
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");

  // Audio & Mic States
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(80);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micVolume, setMicVolume] = useState(90);

  // Feature Toggles
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [dndMode, setDndMode] = useState(false);

  // User SIP Profile
  const userName = lang === "ar" ? "كمال رضوان" : "Kamal Radwan";
  const userExtension = "1001";

  // Keypad keys
  const keypad = [
    { num: "1", sub: "" },
    { num: "2", sub: "ABC" },
    { num: "3", sub: "DEF" },
    { num: "4", sub: "GHI" },
    { num: "5", sub: "JKL" },
    { num: "6", sub: "MNO" },
    { num: "7", sub: "PQRS" },
    { num: "8", sub: "TUV" },
    { num: "9", sub: "WXYZ" },
    { num: "*", sub: "" },
    { num: "0", sub: "+" },
    { num: "#", sub: "" },
  ];

  const handleKeyPress = (char: string) => {
    playDtmfTone(char);
    setDialNumber((prev) => prev + char);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/[0-9*#]/.test(e.key)) {
      playDtmfTone(e.key);
    }
  };

  const handleBackspace = () => {
    setDialNumber((prev) => prev.slice(0, -1));
  };

  const handleCopyNumber = () => {
    if (!dialNumber) return;
    navigator.clipboard.writeText(dialNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const toggleCall = () => {
    if (isCalling) {
      setIsCalling(false);
      setIsTransferOpen(false);
    } else {
      if (!dialNumber) return;
      setIsCalling(true);
    }
  };

  // Incoming Call Actions
  const handleAnswerIncoming = () => {
    if (!incomingCall) return;
    setDialNumber(incomingCall.callerNumber);
    setIsCalling(true);
    setIncomingCall(null);
    setIsPopupDismissed(false);
    setIsExpanded(true);
  };

  const handleDeclineIncoming = () => {
    setIncomingCall(null);
    setIsPopupDismissed(false);
  };

  const handleTransferIncoming = () => {
    setIsTransferOpen(true);
    setIsExpanded(true);
    setIncomingCall(null);
    setIsPopupDismissed(false);
  };

  const handleAddLead = () => {
    if (!incomingCall) return;
    alert(
      lang === "ar"
        ? `تم إنشاء عميل محتمل جديد برقم: ${incomingCall.callerNumber}`
        : `New Lead created with number: ${incomingCall.callerNumber}`
    );
  };

  const executeTransfer = () => {
    if (!transferTarget) return;
    alert(lang === "ar" ? `تم تحويل المكالمة إلى: ${transferTarget}` : `Call transferred to: ${transferTarget}`);
    setIsTransferOpen(false);
    setIsCalling(false);
    setTransferTarget("");
  };

  const simulateIncomingCall = () => {
    const isNew = Boolean(incomingCall?.isExistingContact);
    setIncomingCall({
      callerName: isNew 
        ? (lang === "ar" ? "متصل مجهول" : "Unknown Caller") 
        : (lang === "ar" ? "أحمد محمود (شركة الأمل)" : "Ahmed Mahmoud (Acme Corp)"),
      callerNumber: isNew ? "+20 111 222 3334" : "+20 100 987 6543",
      isExistingContact: !isNew,
      contactType: "customer",
      contactId: "1",
    });
    setIsPopupDismissed(false);
  };

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1: COMPACT FLOATING INCOMING CALL POPUP CARD ON TOP */}
      {/* ------------------------------------------------------------- */}
      {incomingCall && !isPopupDismissed && (
        <div className="fixed top-4 start-1/2 -translate-x-1/2 z-50 w-80 bg-slate-900/95 text-white p-3 rounded-2xl border border-slate-700/80 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5 mb-2.5">
            {/* Animated Pulsing Ring Avatar */}
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shrink-0 shadow-md shadow-emerald-500/30">
              <PhoneIncoming className="w-4 h-4 animate-bounce" />
              <span className="animate-ping absolute inset-0 rounded-xl bg-emerald-400 opacity-40" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {lang === "ar" ? "مكالمة واردة" : "Incoming Call"}
                </span>
                
                {/* Dismiss Popup 'X' Button */}
                <button
                  type="button"
                  onClick={() => setIsPopupDismissed(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={lang === "ar" ? "إغلاق النافذة فقط (تبقى المكالمة جارية)" : "Dismiss popup (call remains active)"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <h3 className="text-xs font-extrabold truncate text-white">
                  {incomingCall.callerName}
                </h3>

                {/* LEAD / CUSTOMER ACTION BUTTON */}
                {incomingCall.isExistingContact ? (
                  <Link
                    href={`/users/${incomingCall.contactId || "1"}`}
                    className="px-2 py-0.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/60 text-[10px] font-bold text-blue-300 flex items-center gap-1 shrink-0 transition-colors"
                    title={lang === "ar" ? "الانتقال لملف العميل" : "View Customer Profile"}
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>{lang === "ar" ? "العميل" : "Customer"}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddLead}
                    className="px-2 py-0.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/60 text-[10px] font-bold text-amber-300 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    title={lang === "ar" ? "إضافة كعميل محتمل" : "Create New Lead"}
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>{lang === "ar" ? "+ عميل" : "+ Lead"}</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                {incomingCall.callerNumber}
              </p>
            </div>
          </div>

          {/* Action Buttons: Answer - Decline - Transfer */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800">
            {/* Answer */}
            <button
              onClick={handleAnswerIncoming}
              className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "رد" : "Answer"}</span>
            </button>

            {/* Decline */}
            <button
              onClick={handleDeclineIncoming}
              className="py-1.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "رفض" : "Decline"}</span>
            </button>

            {/* Transfer */}
            <button
              onClick={handleTransferIncoming}
              className="py-1.5 px-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
            >
              <PhoneForwarded className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "تحويل" : "Transfer"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* FLOATING WEBRTC PHONE WIDGET AT BOTTOM END */}
      {/* ------------------------------------------------------------- */}
      <div className="fixed bottom-0 end-4 z-50 transition-all duration-300 select-none">
        
        {/* COLLAPSED BAR */}
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-t-2xl text-white border-t border-x border-slate-700/80 shadow-2xl backdrop-blur-md transition-all cursor-pointer group ${
              incomingCall ? "bg-emerald-900/90 border-emerald-500 animate-pulse" : "bg-slate-900"
            }`}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  incomingCall ? "bg-emerald-300" : isConnected ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  incomingCall ? "bg-emerald-400" : isConnected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
            </span>

            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <PhoneCall className={`w-3.5 h-3.5 ${incomingCall ? "text-emerald-300 animate-bounce" : "text-blue-400"}`} />
              {incomingCall ? (
                <span className="text-emerald-200 font-bold">{lang === "ar" ? "مكالمة واردة..." : "Incoming Call..."}</span>
              ) : (
                <>
                  <span className="text-xs">{userName}</span>
                  <span className="text-slate-400 font-mono text-[10px]">Ext. {userExtension}</span>
                </>
              )}
            </div>

            <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
        ) : (

          /* EXPANDED COMPACT WEBRTC PHONE WIDGET */
          <div className="w-68 bg-white dark:bg-slate-900 rounded-t-3xl border-t border-x border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            
            {/* 1: PHONE HEAD HEADER */}
            <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsConnected(!isConnected)}
                  title={isConnected ? "Connected (Click to disconnect)" : "Disconnected (Click to connect)"}
                  className="relative flex h-2.5 w-2.5 shrink-0 cursor-pointer"
                >
                  {isConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      isConnected ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                </button>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold truncate flex items-center gap-1">
                    {userName}
                    <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({userExtension})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* TEST CALL TRIGGER BUTTON (INSIDE EXPANDED PHONE ONLY) */}
                <button
                  type="button"
                  onClick={simulateIncomingCall}
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                  title={lang === "ar" ? "تجربة مكالمة واردة" : "Test Incoming Call"}
                >
                  ⚡ Test
                </button>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={lang === "ar" ? "إغلاق الهاتف" : "Collapse Phone"}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3">

              {/* TRANSFER PROMPT INLINE MODAL */}
              {isTransferOpen && (
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/80 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-300">
                    <span className="flex items-center gap-1.5">
                      <PhoneForwarded className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      {lang === "ar" ? "تحويل المكالمة" : "Transfer Call"}
                    </span>
                    <button
                      onClick={() => setIsTransferOpen(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      {lang === "ar" ? "إلغاء" : "Cancel"}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    onKeyDown={(e) => {
                      if (/[0-9*#]/.test(e.key)) playDtmfTone(e.key);
                    }}
                    placeholder={lang === "ar" ? "رقم المحول إليه (مثال: 1002)..." : "Target Ext (e.g. 1002)..."}
                    className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                    autoFocus
                  />

                  <button
                    onClick={executeTransfer}
                    className="w-full py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {lang === "ar" ? "تأكيد التحويل" : "Confirm Transfer"}
                  </button>
                </div>
              )}

              {/* 2: CALL INPUT DISPLAY WITH COPY BUTTON */}
              <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 px-2.5 py-1.5">
                <input
                  type="text"
                  value={incomingCall ? incomingCall.callerNumber : dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={isCalling ? (lang === "ar" ? "جاري الاتصال..." : "In Call...") : (lang === "ar" ? "أدخل الرقم..." : "Enter number...")}
                  className="w-full text-base font-bold font-mono text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:text-xs"
                />

                <div className="flex items-center gap-1 shrink-0">
                  {dialNumber && (
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Delete className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={handleCopyNumber}
                    disabled={!dialNumber && !incomingCall}
                    title={lang === "ar" ? "نسخ الرقم" : "Copy number"}
                    className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 3: DIAL BODY KEYPAD (0-9 + *#) WITH DTMF TONES */}
              <div className="grid grid-cols-3 gap-1.5">
                {keypad.map((k) => (
                  <button
                    key={k.num}
                    type="button"
                    onClick={() => handleKeyPress(k.num)}
                    className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center transition-colors cursor-pointer active:scale-95"
                  >
                    <span className="text-sm font-bold font-mono leading-none">{k.num}</span>
                    {k.sub && <span className="text-[8px] text-slate-400 font-mono leading-none mt-0.5">{k.sub}</span>}
                  </button>
                ))}
              </div>

              {/* CALL / INCOMING ACTIONS BUTTONS ROW */}
              {incomingCall ? (
                /* INCOMING CALL ACTIVE: SPLIT INTO ANSWER & DECLINE */
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleAnswerIncoming}
                    className="py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{lang === "ar" ? "رد" : "Answer"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeclineIncoming}
                    className="py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>{lang === "ar" ? "رفض" : "Decline"}</span>
                  </button>
                </div>
              ) : (
                /* STANDARD CALL / HANGUP BUTTON */
                <button
                  type="button"
                  onClick={toggleCall}
                  disabled={!isConnected}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    isCalling
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {isCalling ? (
                    <>
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "إنهاء المكالمة" : "End Call"}</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "إجراء مكالمة" : "Call"}</span>
                    </>
                  )}
                </button>
              )}

              {/* 4 & 5: SPEAKER & MIC AUDIO CONTROLS */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                
                {/* Speaker Control */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isSpeakerMuted ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                    title={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
                  >
                    {isSpeakerMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isSpeakerMuted ? 0 : speakerVolume}
                    onChange={(e) => {
                      setSpeakerVolume(Number(e.target.value));
                      if (isSpeakerMuted) setIsSpeakerMuted(false);
                    }}
                    className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[9px] text-slate-400 font-mono w-5 text-end">{isSpeakerMuted ? 0 : speakerVolume}%</span>
                </div>

                {/* Mic Control */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMicMuted(!isMicMuted)}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isMicMuted ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                    title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                  >
                    {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMicMuted ? 0 : micVolume}
                    onChange={(e) => {
                      setMicVolume(Number(e.target.value));
                      if (isMicMuted) setIsMicMuted(false);
                    }}
                    className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[9px] text-slate-400 font-mono w-5 text-end">{isMicMuted ? 0 : micVolume}%</span>
                </div>
              </div>

              {/* 6: FEATURE TOGGLE BUTTONS (AA, DND, TRANSFER) */}
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAutoAnswer(!autoAnswer)}
                  className={`py-1 px-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                    autoAnswer
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>AA</span>
                  <span className="text-[9px] font-normal">({autoAnswer ? "On" : "Off"})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDndMode(!dndMode)}
                  className={`py-1 px-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                    dndMode
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>DND</span>
                  <span className="text-[9px] font-normal">({dndMode ? "On" : "Off"})</span>
                </button>

                {/* TRANSFER BUTTON BESIDE DND */}
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(!isTransferOpen)}
                  className={`py-1 px-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                    isTransferOpen
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={lang === "ar" ? "تحويل المكالمة" : "Transfer Call"}
                >
                  <PhoneForwarded className="w-3 h-3 shrink-0" />
                  <span>{lang === "ar" ? "تحويل" : "TRF"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
