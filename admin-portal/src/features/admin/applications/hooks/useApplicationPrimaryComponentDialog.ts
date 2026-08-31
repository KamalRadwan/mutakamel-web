import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

interface Options {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
  onClearCommandError: () => void;
}

export function useApplicationPrimaryComponentDialog({
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  onClearCommandError,
}: Options) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setReason("");
      setValidationError(null);
      onClearCommandError();
    });
  }, [isOpen, onClearCommandError]);

  const close = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  const updateReason = useCallback((value: string) => {
    setReason(value);
    setValidationError(null);
  }, []);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!reason.trim()) {
        setValidationError(t.applications.technicalProvisioning.reasonError);
        return;
      }
      setValidationError(null);
      const completed = await onConfirm(reason.trim());
      if (completed) onClose();
    },
    [onClose, onConfirm, reason, t],
  );

  return {
    reason,
    setReason: updateReason,
    validationError,
    close,
    submit,
  };
}

