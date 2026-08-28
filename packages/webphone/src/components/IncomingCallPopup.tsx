"use client";

import { createPortal } from "react-dom";
import { PhoneIncoming, PhoneOff, X } from "lucide-react";
import { useWebphoneContext } from "../context/WebphoneContext";

type IncomingCallPopupProps = {
  open: boolean;
  phoneNumber: string;
  displayName?: string;
  onAnswer: () => void;
  onDecline: () => void;
  onClose: () => void;
};

export function IncomingCallPopup({
  open,
  phoneNumber,
  displayName,
  onAnswer,
  onDecline,
  onClose,
}: IncomingCallPopupProps) {
  const { copy } = useWebphoneContext();

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <aside
      className="fixed top-4 start-1/2 z-[80] grid w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-3.5 text-white shadow-2xl backdrop-blur-xl"
      aria-label={copy.incoming}
      aria-live="assertive"
    >
      <button
        className="absolute top-2 end-2 grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        type="button"
        aria-label={copy.dismissAlert}
        onClick={onClose}
      >
        <X className="size-4" />
      </button>

      <div className="flex min-w-0 items-center gap-3 pe-9">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
          <PhoneIncoming className="relative z-10 size-5" />
          <span className="absolute inset-0 animate-ping rounded-xl bg-emerald-400 opacity-30" />
        </span>
        <span className="min-w-0">
          <small className="block text-[11px] font-bold tracking-wide text-emerald-400">
            {copy.incoming}
          </small>
          <strong className="block truncate text-sm font-extrabold">
            {displayName || phoneNumber || copy.unknownCaller}
          </strong>
          {displayName ? (
            <span className="block truncate font-mono text-xs text-slate-300">
              {phoneNumber}
            </span>
          ) : null}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          onClick={onAnswer}
        >
          <PhoneIncoming className="size-4" />
          {copy.answer}
        </button>
        <button
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white transition-colors hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
          onClick={onDecline}
        >
          <PhoneOff className="size-4" />
          {copy.decline}
        </button>
      </div>
    </aside>,
    document.body,
  );
}
