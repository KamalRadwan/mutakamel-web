// Re-export shim (docs/design-system/migration.md Phase 13). The real
// modal implementation moved to src/design-system/patterns/confirm-action/
// ConfirmActionModal.tsx, which absorbs this component's 9 actionType
// variants and type-the-name confirmation. This module path and prop
// shape stay exactly as they were so the 14 existing call sites are
// unaffected.
"use client";

import {
  Trash2,
  PauseCircle,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  Lock,
  Key,
  type LucideIcon,
} from "lucide-react";
import {
  ConfirmActionModal,
  type ConfirmActionModalProps,
} from "@/design-system/patterns/confirm-action/ConfirmActionModal";

export interface DestructiveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  targetName: string;
  actionType:
    | "drain"
    | "offline"
    | "suspend"
    | "delete"
    | "destroy"
    | "activate"
    | "reset-password"
    | "change-password"
    | "revoke-session";
  requireNameTyping?: boolean;
  isSubmitting?: boolean;
  confirmLabel?: string;
  submittingLabel?: string;
  extraToggle?: { label: string; checked: boolean; onChange: (checked: boolean) => void };
}

const ACTION_VARIANT: Record<DestructiveActionModalProps["actionType"], ConfirmActionModalProps["variant"]> = {
  activate: "info",
  "reset-password": "warning",
  "change-password": "info",
  destroy: "danger",
  delete: "danger",
  "revoke-session": "danger",
  suspend: "warning",
  drain: "warning",
  offline: "danger",
};

const ACTION_ICON: Record<DestructiveActionModalProps["actionType"], LucideIcon> = {
  activate: CheckCircle2,
  "reset-password": Lock,
  "change-password": Key,
  destroy: ShieldAlert,
  delete: Trash2,
  "revoke-session": ShieldAlert,
  suspend: PauseCircle,
  drain: RotateCcw,
  offline: PauseCircle,
};

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
  return (
    <ConfirmActionModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      // The caller already resolved these to the active language before
      // passing them in (this component predates the bilingual-props
      // convention), so the same string covers both branches.
      titleEn={title}
      titleAr={title}
      descriptionEn={description}
      descriptionAr={description}
      confirmTextEn={confirmLabel}
      confirmTextAr={confirmLabel}
      variant={ACTION_VARIANT[actionType]}
      requiredConfirmationText={requireNameTyping ? targetName : undefined}
      isLoading={isSubmitting}
      icon={ACTION_ICON[actionType]}
      extraToggle={extraToggle}
      loadingLabel={submittingLabel}
    />
  );
}
