import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../lib/cn";

export type ToastType = "success" | "error" | "info" | "warning";

export interface AppToastProps {
  type: ToastType;
  title: string;
  message?: string;
  dismissLabel: string;
  onDismiss: () => void;
}

// Four tones, not five: "info" is deliberately neutral (ink), not a fifth
// hue — brand stays reserved for success, matching the "no fifth hue"
// status-treatment rule elsewhere in the design system
// (docs/design-system/tokens.md).
const TONE_CLASSES: Record<ToastType, { surface: string; icon: string }> = {
  success: {
    surface: "border-brand-200 bg-brand-50/95 text-brand-900 dark:border-brand-800/80 dark:bg-brand-950/90 dark:text-brand-100",
    icon: "text-brand-600 dark:text-brand-400",
  },
  error: {
    surface: "border-danger-200 bg-danger-50/95 text-danger-900 dark:border-danger-800/80 dark:bg-danger-950/90 dark:text-danger-100",
    icon: "text-danger-600 dark:text-danger-400",
  },
  warning: {
    surface: "border-warn-200 bg-warn-50/95 text-warn-900 dark:border-warn-800/80 dark:bg-warn-950/90 dark:text-warn-100",
    icon: "text-warn-600 dark:text-warn-400",
  },
  info: {
    surface: "border-ink-200 bg-ink-50/95 text-ink-900 dark:border-ink-700/80 dark:bg-ink-900/90 dark:text-ink-100",
    icon: "text-ink-600 dark:text-ink-400",
  },
};

const TONE_ICON: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function AppToast({ type, title, message, dismissLabel, onDismiss }: AppToastProps) {
  const tone = TONE_CLASSES[type];
  const Icon = TONE_ICON[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-lg border p-4 shadow-pop backdrop-blur-md",
        tone.surface,
      )}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("size-5", tone.icon)} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-semibold leading-tight">{title}</h4>
        {message && (
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed opacity-90">{message}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="relative grid shrink-0 size-11 -m-2 place-items-center rounded-lg opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
