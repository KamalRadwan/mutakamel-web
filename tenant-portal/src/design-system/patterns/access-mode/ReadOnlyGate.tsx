"use client";

import { Ban, Lock } from "lucide-react";
import { accessModeCapabilities, type AccessMode } from "@/lib/access-mode";
import { cn } from "../../lib/cn";

export interface ReadOnlyGateLabels {
  /** Heading for the BLOCKED body — the workspace is not readable at all. */
  blockedTitle: string;
  blockedDescription: string;
  /** Strip shown above readable-but-not-writable content. */
  readOnlyNotice: string;
  dunningNotice: string;
}

export interface ReadOnlyGateProps {
  /** null means unresolved — the gate then renders children untouched. */
  mode: AccessMode | null;
  children: React.ReactNode;
  /**
   * The screen hosts an action the backend marks @AllowedDuringDunning().
   * Suppresses the DUNNING notice only; it never re-opens READ_ONLY.
   */
  allowedDuringDunning?: boolean;
  className?: string;
  labels: ReadOnlyGateLabels;
}

// One source of truth for the four access modes, so a screen does not have to
// re-derive "may I show a Save button" from subscription status.
//
// It renders a notice and passes the children through — it does NOT try to
// disable descendant controls by traversing them. A gate that silently
// neuters buttons produces controls that look live and do nothing; a screen
// suppresses its own affordances from useAccessMode().canMutate, which is the
// same value this gate reads.
export function ReadOnlyGate({
  mode,
  children,
  allowedDuringDunning,
  className,
  labels,
}: ReadOnlyGateProps) {
  const { canRead, isRestricted } = accessModeCapabilities(mode);

  if (!canRead) {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center",
          className,
        )}
      >
        <Ban className="size-8 text-negative-600 dark:text-negative-400" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{labels.blockedTitle}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{labels.blockedDescription}</p>
      </div>
    );
  }

  const notice =
    mode === "DUNNING"
      ? allowedDuringDunning
        ? null
        : labels.dunningNotice
      : isRestricted
        ? labels.readOnlyNotice
        : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-1.5 rounded-sm border border-caution-200 bg-caution-100 px-2.5 py-1.5 text-xs text-caution-800",
            "dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300",
          )}
        >
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      )}
      {children}
    </div>
  );
}
