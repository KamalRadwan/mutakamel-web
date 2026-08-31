import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../primitives/Button";

export type ToastType = "success" | "error" | "info" | "warning";

export interface AppToastProps {
  type: ToastType;
  title: string;
  message?: string;
  dismissLabel: string;
  onDismiss: () => void;
}

// Status colors use semantic roles; cobalt remains action/information and
// emerald remains success.
const TONE_CLASSES: Record<ToastType, { surface: string; icon: string }> = {
  success: {
    surface: "border-success/30 bg-success-subtle text-success-subtle-foreground",
    icon: "text-success",
  },
  error: {
    surface: "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground",
    icon: "text-destructive",
  },
  warning: {
    surface: "border-warning/30 bg-warning-subtle text-warning-subtle-foreground",
    icon: "text-warning",
  },
  info: {
    surface: "border-info/30 bg-info-subtle text-info-subtle-foreground",
    icon: "text-info",
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
        "pointer-events-auto flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-lg border p-4 shadow-pop",
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

      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="-m-2 size-11 shrink-0 p-0 opacity-60 transition-opacity hover:opacity-100 motion-reduce:transition-none"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
