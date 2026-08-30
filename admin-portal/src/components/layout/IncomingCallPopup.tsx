"use client";

import { useRef, type RefObject } from "react";
import { PhoneIncoming, PhoneOff, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

type IncomingCallPopupProps = {
  open: boolean;
  phoneNumber: string;
  displayName?: string;
  lang: "ar" | "en";
  onAnswer: () => void;
  onDecline: () => void;
  onClose: () => void;
  fallbackFocusRef?: RefObject<HTMLButtonElement | null>;
};

export function IncomingCallPopup({
  open,
  phoneNumber,
  displayName,
  lang,
  onAnswer,
  onDecline,
  onClose,
  fallbackFocusRef,
}: IncomingCallPopupProps) {
  const answerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const copy = (lang === "ar" ? ar : en).incomingCall;
  const callerName = displayName || phoneNumber || copy.unknownCaller;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <AlertDialogContent
        className="max-w-sm p-4 sm:p-5"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (document.activeElement instanceof HTMLElement) {
            returnFocusRef.current = document.activeElement;
          }
          answerRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          // This controlled alert has no Radix Trigger, so it owns the return
          // target explicitly instead of letting focus fall back to <body>.
          event.preventDefault();
          const previousTarget = returnFocusRef.current;
          const focusTarget =
            previousTarget && previousTarget !== document.body && previousTarget.isConnected
              ? previousTarget
              : fallbackFocusRef?.current;
          focusTarget?.focus({ preventScroll: true });
          returnFocusRef.current = null;
        }}
        onEscapeKeyDown={(event) => {
          // Escape follows the documented dismiss policy: hide the alert while
          // leaving the waiting call available in the expanded phone surface.
          event.preventDefault();
          onClose();
        }}
      >
        <AlertDialogCancel
          aria-label={copy.dismiss}
          className="absolute end-3 top-3 size-8 p-0"
        >
          <X className="size-4" aria-hidden="true" />
        </AlertDialogCancel>

        <AlertDialogHeader className="mb-0">
          <div className="flex min-w-0 items-center gap-3 pe-9">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-lg bg-info-subtle text-info-subtle-foreground">
              <PhoneIncoming className="relative z-10 size-5" aria-hidden="true" />
              <span
                className="absolute inset-0 animate-ping rounded-lg bg-info opacity-20 motion-reduce:animate-none"
                aria-hidden="true"
              />
            </span>

            <span className="min-w-0 text-start">
              <AlertDialogTitle
                className={`text-xs font-semibold uppercase text-info-subtle-foreground ${
                  lang === "ar" ? "tracking-normal" : "tracking-wide"
                }`}
              >
                {copy.label}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <span className="mt-1 block text-foreground">
                  <strong className="block truncate text-base font-semibold">
                    {displayName ? callerName : <bdi dir="ltr">{callerName}</bdi>}
                  </strong>
                  {displayName ? (
                    <bdi dir="ltr" className="block truncate font-mono text-xs text-muted-foreground">
                      {phoneNumber}
                    </bdi>
                  ) : null}
                </span>
              </AlertDialogDescription>
            </span>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4">
          <AlertDialogAction ref={answerRef} onClick={onAnswer} className="gap-2">
            <PhoneIncoming className="size-4" aria-hidden="true" />
            {copy.answer}
          </AlertDialogAction>
          <AlertDialogAction destructive onClick={onDecline} className="gap-2">
            <PhoneOff className="size-4" aria-hidden="true" />
            {copy.decline}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
