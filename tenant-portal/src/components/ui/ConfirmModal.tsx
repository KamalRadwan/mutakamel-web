"use client";

import { useId } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isSubmitting?: boolean;
  closeOnConfirm?: boolean;
  loadingText?: string;
  error?: string | null;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  isDanger = true,
  isSubmitting = false,
  closeOnConfirm = true,
  loadingText,
  error,
}: ConfirmModalProps) {
  const { t, lang } = useI18n();
  const messageId = useId();

  const confirm = () => {
    if (isSubmitting) return;
    onConfirm();
    if (closeOnConfirm) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t.common.confirmDelete}
      maxWidth="sm"
      closeDisabled={isSubmitting}
      closeLabel={lang === "ar" ? "إغلاق نافذة التأكيد" : "Close confirmation"}
      initialFocusSelector="[data-confirm-cancel]"
      ariaDescribedBy={messageId}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${isDanger ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p id={messageId} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {message || "هل أنت تأكد من متابعة هذا الإجراء الحرج؟ لا يمكن التراجع عن ذلك."}
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} data-confirm-cancel>
            {cancelText || t.common.cancel}
          </Button>
          <Button
            variant={isDanger ? "danger" : "primary"}
            type="button"
            onClick={confirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {loadingText || confirmText || (isDanger ? t.common.delete : t.common.save)}
              </>
            ) : confirmText || (isDanger ? t.common.delete : t.common.save)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
