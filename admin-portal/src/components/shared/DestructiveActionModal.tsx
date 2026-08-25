"use client";

import { useState, useEffect, useId, useRef, type KeyboardEvent } from "react";
import { Trash2, PauseCircle, ShieldAlert, RotateCcw, X, Loader2, CheckCircle2, Lock, Key } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export interface DestructiveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  targetName: string;
  actionType: "drain" | "offline" | "suspend" | "delete" | "destroy" | "activate" | "reset-password" | "change-password" | "revoke-session";
  requireNameTyping?: boolean;
  isSubmitting?: boolean;
  confirmLabel?: string;
  submittingLabel?: string;
  extraToggle?: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
}

export function DestructiveActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetName,
  actionType,
  requireNameTyping = true,
  isSubmitting = false,
  confirmLabel,
  submittingLabel,
  extraToggle,
}: DestructiveActionModalProps) {
  const { lang } = useI18n();
  const [typedInput, setTypedInput] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      setTypedInput("");
      const initialTarget = requireNameTyping
        ? dialogRef.current?.querySelector<HTMLElement>("input:not([disabled])")
        : dialogRef.current?.querySelector<HTMLElement>("[data-dialog-cancel]");
      initialTarget?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, requireNameTyping]);

  if (!isOpen) return null;

  const isConfirmed = !requireNameTyping || typedInput.trim().toLowerCase() === targetName.trim().toLowerCase();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!isSubmitting) onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const getActionColor = () => {
    switch (actionType) {
      case "activate":
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30";
      case "reset-password":
      case "change-password":
        return "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30";
      case "destroy":
        return "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/30";
      case "delete":
      case "revoke-session":
        return "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30";
      case "suspend":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30";
      case "drain":
        return "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30";
      case "offline":
        return "bg-slate-700 hover:bg-slate-800 text-white shadow-slate-700/30";
    }
  };

  const getActionIcon = () => {
    switch (actionType) {
      case "activate":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "reset-password":
        return <Lock className="w-5 h-5 text-amber-500" />;
      case "change-password":
        return <Key className="w-5 h-5 text-blue-600" />;
      case "destroy":
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      case "delete":
        return <Trash2 className="w-5 h-5 text-rose-600" />;
      case "revoke-session":
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      case "suspend":
        return <PauseCircle className="w-5 h-5 text-amber-600" />;
      case "drain":
        return <RotateCcw className="w-5 h-5 text-purple-600" />;
      case "offline":
        return <PauseCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !isSubmitting) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={isSubmitting} onKeyDown={handleKeyDown} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label={lang === "ar" ? "إغلاق" : "Close"}
          className="absolute top-4 end-4 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
            {getActionIcon()}
          </div>
          <div>
            <h3 id={titleId} className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p id={descriptionId} className="text-[11px] text-slate-500">{description}</p>
          </div>
        </div>

        <div className="space-y-3">
          {requireNameTyping ? (
            <>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-300">
                <span>
                  {lang === "ar"
                    ? `للتأكيد، يرجى كتابة الاسم بالضبط:`
                    : `To confirm, please type the exact name:`}
                </span>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm mt-1 select-all">
                  {targetName}
                </div>
              </div>

              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder={targetName}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                autoFocus
              />
            </>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-mono">
              <span>{targetName}</span>
            </div>
          )}

          {extraToggle && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-rose-700 dark:text-rose-400 pt-1">
              <input
                type="checkbox"
                checked={extraToggle.checked}
                onChange={(e) => extraToggle.onChange(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600"
              />
              <span>{extraToggle.label}</span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            data-dialog-cancel
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>

          <button
            type="button"
            disabled={!isConfirmed || isSubmitting}
            onClick={() => {
              if (isConfirmed) {
                onConfirm();
              }
            }}
            className={`px-5 py-2 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${getActionColor()}`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{submittingLabel ?? (lang === "ar" ? "جاري التنفيذ..." : "Executing...")}</span>
              </span>
            ) : (
              <span>{confirmLabel ?? (lang === "ar" ? "تأكيد التنفيذ" : "Confirm Action")}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");
