"use client";

import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";
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
}: ConfirmModalProps) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || t.common.confirmDelete} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${isDanger ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {message || "هل أنت تأكد من متابعة هذا الإجراء الحرج؟ لا يمكن التراجع عن ذلك."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            {cancelText || t.common.cancel}
          </Button>
          <Button
            variant={isDanger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText || (isDanger ? t.common.delete : t.common.save)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
