"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export type AppToastType = "success" | "error" | "warning" | "info";

export interface AppToastProps {
  type: AppToastType;
  title: string;
  message?: string;
  onDismiss: () => void;
}

const ICONS: Record<AppToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

// Color is reinforcement on the icon only — the surface stays neutral, same
// principle as StatusBadge always carrying a text label.
const ICON_TONE: Record<AppToastType, string> = {
  success: "text-positive-600 dark:text-positive-400",
  error: "text-negative-600 dark:text-negative-400",
  warning: "text-caution-600 dark:text-caution-400",
  info: "text-ink-500 dark:text-ink-400",
};

export function AppToast({ type, title, message, onDismiss }: AppToastProps) {
  const { t } = useI18n();
  const Icon = ICONS[type];

  return (
    // B14 — the toast accessibility contract, in one place:
    //   * role="status" ALWAYS, never role="alert". alert implies
    //     aria-live="assertive", which interrupts what the user is reading
    //     mid-sentence; every write result in this product is a toast, so
    //     assertive would make the app shout constantly.
    //   * aria-live and aria-atomic are stated rather than left implicit,
    //     because sonner's own wrapper is aria-atomic="false" and would
    //     otherwise announce only the changed text node.
    //   * Nothing here is autofocused. Focus stays where the user put it.
    //   * The dismiss control is a real button, so a permanent
    //     (duration: 0) toast is always keyboard-dismissable.
    // docs/design/DESIGN-SYSTEM.md#the-accessibility-contract.
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex w-full max-w-sm items-start gap-2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-overlay"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_TONE[type])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {/* wrap-anywhere, not break-all: the message often ends in a bare
            36-character correlationId, which otherwise pushes the toast off
            screen — B11, typography.md#identifiers-wrap-never-overflow. */}
        {message && (
          <p className="mt-0.5 whitespace-pre-line wrap-anywhere text-xs text-muted-foreground">
            <bdi>{message}</bdi>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t.common.dismiss}
        className={cn(
          "relative -m-1 shrink-0 cursor-pointer rounded-xs p-1 text-muted-foreground opacity-70 hover:opacity-100",
          focusRing,
        )}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
