"use client";

import { useId, useState, useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ShieldAlert, Info, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../../primitives/AlertDialog";
import { Checkbox } from "../../primitives/Checkbox";
import { Input } from "../../primitives/Input";
import { focusRing } from "../../lib/variants";
import { cn } from "../../lib/cn";

const VARIANT_ICON: Record<"danger" | "warning" | "info", LucideIcon> = {
  danger: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_ICON_CLASS: Record<"danger" | "warning" | "info", string> = {
  danger: "text-destructive",
  warning: "text-warning",
  info: "text-info",
};

/**
 * Implements docs/components/confirm-action-modal.md. Built on Radix
 * AlertDialog, which owns focus trap / scroll lock / Esc natively — the old
 * DestructiveActionModal.tsx's hand-rolled useEffect/useRef/handleKeyDown
 * focus-management block (~30 lines) is gone entirely, not reimplemented.
 *
 * requiredConfirmationText covers the spec's typed-confirmation feature;
 * icon/iconClassName/extraToggle are additive, non-spec props that let
 * DestructiveActionModal.tsx's 9 actionType variants and extraToggle
 * checkbox be expressed without a second implementation.
 */
export interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  confirmTextEn?: string;
  confirmTextAr?: string;
  variant?: "danger" | "warning" | "info";
  requiredConfirmationText?: string;
  isLoading?: boolean;
  icon?: LucideIcon;
  iconClassName?: string;
  extraToggle?: { label: string; checked: boolean; onChange: (checked: boolean) => void };
  /** Overrides the default "Executing.../جاري التنفيذ..." while isLoading. */
  loadingLabel?: string;
}

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  titleEn,
  titleAr,
  descriptionEn,
  descriptionAr,
  confirmTextEn,
  confirmTextAr,
  variant = "danger",
  requiredConfirmationText,
  isLoading = false,
  icon,
  iconClassName,
  extraToggle,
  loadingLabel,
}: ConfirmActionModalProps) {
  const { lang } = useI18n();
  const [typedInput, setTypedInput] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (isOpen) queueMicrotask(() => setTypedInput(""));
  }, [isOpen]);

  // High-impact confirmation is deliberately byte-for-byte exact. Trimming or
  // case folding would contradict the visible instruction and can turn a
  // mistyped resource identifier into an accepted destructive intent.
  const isConfirmed = !requiredConfirmationText || typedInput === requiredConfirmationText;
  const Icon = icon ?? VARIANT_ICON[variant];

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        aria-busy={isLoading || undefined}
      >
        <AlertDialogCancel
          disabled={isLoading}
          aria-label={lang === "ar" ? "إغلاق" : "Close"}
          className={cn(
            "absolute end-4 top-4 h-auto w-auto rounded-md border-0 bg-transparent p-1.5 text-muted-foreground opacity-60 transition-opacity hover:bg-accent hover:opacity-100 motion-reduce:transition-none",
            focusRing,
          )}
        >
          <X className="size-4" aria-hidden="true" />
        </AlertDialogCancel>
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
          <div className="rounded-md bg-muted p-2">
            <Icon className={iconClassName ?? `size-5 ${VARIANT_ICON_CLASS[variant]}`} aria-hidden="true" />
          </div>
          <div>
            <AlertDialogTitle className="text-sm font-semibold">
              {lang === "ar" ? titleAr : titleEn}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {lang === "ar" ? descriptionAr : descriptionEn}
            </AlertDialogDescription>
          </div>
        </div>

        {requiredConfirmationText && (
          <div className="space-y-2">
            <div className="rounded-md border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
              <span>
                {lang === "ar" ? "للتأكيد، يرجى كتابة الاسم بالضبط:" : "To confirm, please type the exact name:"}
              </span>
              <div className="mt-1 select-all font-mono text-sm font-semibold text-foreground">
                {requiredConfirmationText}
              </div>
            </div>
            <Input
              id={inputId}
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={requiredConfirmationText}
              aria-label={lang === "ar" ? "اكتب الاسم بالضبط للتأكيد" : "Type the exact name to confirm"}
              autoFocus
              className="font-mono text-xs"
            />
          </div>
        )}

        {extraToggle && (
          <label className="mt-3 flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-destructive">
            <Checkbox checked={extraToggle.checked} onCheckedChange={(c) => extraToggle.onChange(c === true)} />
            {extraToggle.label}
          </label>
        )}

        <AlertDialogFooterActions
          isLoading={isLoading}
          isConfirmed={isConfirmed}
          variant={variant}
          onConfirm={onConfirm}
          confirmLabel={lang === "ar" ? confirmTextAr : confirmTextEn}
          loadingLabel={loadingLabel}
          lang={lang}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AlertDialogFooterActions({
  isLoading,
  isConfirmed,
  variant,
  onConfirm,
  confirmLabel,
  loadingLabel,
  lang,
}: {
  isLoading: boolean;
  isConfirmed: boolean;
  variant: "danger" | "warning" | "info";
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
  loadingLabel?: string;
  lang: "ar" | "en";
}): ReactNode {
  return (
    <div className="mt-6 flex items-center justify-end gap-2">
      <AlertDialogCancel disabled={isLoading}>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
      <AlertDialogAction
        destructive={variant === "danger"}
        disabled={!isConfirmed || isLoading}
        aria-busy={isLoading || undefined}
        onClick={(e) => {
          e.preventDefault();
          if (isConfirmed) void onConfirm();
        }}
      >
        {isLoading
          ? (loadingLabel ?? (lang === "ar" ? "جاري التنفيذ..." : "Executing..."))
          : (confirmLabel ?? (lang === "ar" ? "تأكيد التنفيذ" : "Confirm Action"))}
      </AlertDialogAction>
    </div>
  );
}
