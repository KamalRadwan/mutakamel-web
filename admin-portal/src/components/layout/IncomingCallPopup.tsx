"use client";

import { createPortal } from "react-dom";
import { PhoneIncoming, PhoneOff, X } from "lucide-react";

type IncomingCallPopupProps = {
  open: boolean;
  phoneNumber: string;
  displayName?: string;
  lang: "ar" | "en";
  onAnswer: () => void;
  onDecline: () => void;
  onClose: () => void;
};

export function IncomingCallPopup({
  open,
  phoneNumber,
  displayName,
  lang,
  onAnswer,
  onDecline,
  onClose,
}: IncomingCallPopupProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <aside
      className="fixed top-4 start-1/2 z-[80] grid w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 gap-3 rounded-xl border border-ink-700/80 bg-ink-950/95 p-3.5 text-ink-50 shadow-2xl"
      aria-label={lang === "ar" ? "مكالمة واردة" : "Incoming call"}
      aria-live="assertive"
    >
      <button
        className="absolute top-2 end-2 grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        type="button"
        aria-label={lang === "ar" ? "إخفاء التنبيه" : "Dismiss alert"}
        onClick={onClose}
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 items-center gap-3 pe-9">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-ink-950 shadow-lg shadow-brand-500/25">
          <PhoneIncoming className="relative z-10 size-5" aria-hidden="true" />
          <span className="absolute inset-0 animate-ping rounded-xl bg-brand-400 opacity-30 motion-reduce:animate-none" />
        </span>
        <span className="min-w-0">
          <small className="block text-xs font-semibold tracking-wide text-brand-400">
            {lang === "ar" ? "مكالمة واردة" : "Incoming call"}
          </small>
          <strong className="block truncate text-sm font-semibold">
            {displayName || phoneNumber || (lang === "ar" ? "متصل غير معروف" : "Unknown caller")}
          </strong>
          {displayName ? (
            <span className="block truncate font-mono text-xs text-ink-300">{phoneNumber}</span>
          ) : null}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-ink-800 pt-3">
        <button
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-xs font-semibold text-ink-950 transition-colors hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          onClick={onAnswer}
        >
          <PhoneIncoming className="size-4" aria-hidden="true" />
          {lang === "ar" ? "رد" : "Answer"}
        </button>
        <button
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-danger-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-400"
          onClick={onDecline}
        >
          <PhoneOff className="size-4" aria-hidden="true" />
          {lang === "ar" ? "رفض" : "Decline"}
        </button>
      </div>
    </aside>,
    document.body,
  );
}
