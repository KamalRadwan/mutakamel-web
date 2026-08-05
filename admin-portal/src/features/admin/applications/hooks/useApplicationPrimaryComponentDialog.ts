import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

interface Options {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (
    componentKey: string,
    contractVersion: number,
    reason: string,
  ) => Promise<boolean>;
  onClearCommandError: () => void;
}

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useApplicationPrimaryComponentDialog({
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  onClearCommandError,
}: Options) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [componentKey, setComponentKey] = useState("");
  const [contractVersion, setContractVersion] = useState("1");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => {
      setComponentKey("");
      setContractVersion("1");
      setReason("");
      setValidationError(null);
      onClearCommandError();
      initialFocusRef.current?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [isOpen, onClearCommandError]);

  const close = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
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
    },
    [close],
  );

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const normalizedComponentKey = componentKey.trim();
      if (
        !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/.test(
          normalizedComponentKey,
        ) ||
        normalizedComponentKey.length > 96
      ) {
        setValidationError(
          t.applications.technicalProvisioning.componentKeyError,
        );
        return;
      }
      const parsedVersion = Number(contractVersion);
      if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
        setValidationError(
          t.applications.technicalProvisioning.contractVersionError,
        );
        return;
      }
      if (!reason.trim()) {
        setValidationError(t.applications.technicalProvisioning.reasonError);
        return;
      }
      setValidationError(null);
      const completed = await onConfirm(
        normalizedComponentKey,
        parsedVersion,
        reason.trim(),
      );
      if (completed) onClose();
    },
    [componentKey, contractVersion, onClose, onConfirm, reason, t],
  );

  return {
    dialogRef,
    initialFocusRef,
    componentKey,
    setComponentKey,
    contractVersion,
    setContractVersion,
    reason,
    setReason,
    validationError,
    close,
    onKeyDown,
    submit,
  };
}

