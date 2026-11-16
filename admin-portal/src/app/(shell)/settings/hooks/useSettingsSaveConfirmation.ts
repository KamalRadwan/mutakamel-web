"use client";

import { useRef, useState } from "react";

/** Keeps confirmation separate from the existing write/recovery lifecycle. */
export function useSettingsSaveConfirmation(save: () => Promise<void>) {
  const [isOpen, setIsOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const submitting = useRef(false);

  const close = () => {
    setIsOpen(false);
  };

  // These dialogs are opened by ordinary buttons, not Radix triggers.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (opener.current?.isConnected) opener.current.focus();
  };

  const request = () => {
    if (submitting.current) return;
    opener.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setIsOpen(true);
  };

  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    close();
    try {
      await save();
    } finally {
      submitting.current = false;
    }
  };

  return { isOpen, request, cancel: close, confirm, restoreFocus };
}
