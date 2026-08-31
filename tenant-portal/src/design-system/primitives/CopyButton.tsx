"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/cn";
import { type ControlSizeProps } from "../lib/variants";
import { Button, type ButtonProps } from "./Button";

export interface CopyButtonProps extends ControlSizeProps {
  /** The exact value to place on the clipboard — a UUID, correlation id or cursor, verbatim. */
  value: string;
  /** Accessible name in the resting state, e.g. "Copy correlation ID". */
  copyLabel: string;
  /** Announced after a successful copy, e.g. "Copied". */
  copiedLabel: string;
  /** Announced when the clipboard is unavailable — a non-secure origin, or a denied permission. */
  failedLabel: string;
  /** Render the label beside the icon instead of icon-only. */
  showLabel?: boolean;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  className?: string;
}

const RESET_MS = 2000;

/**
 * The copy affordance for the identifiers this product shows constantly.
 *
 * The confirmation is announced through an `aria-live` region rather than by
 * swapping the button's own accessible name: a name that changes under the
 * user is re-announced as a *new control*, which reads as the button having
 * been replaced rather than as the copy having succeeded.
 */
export function CopyButton({
  value,
  copyLabel,
  copiedLabel,
  failedLabel,
  showLabel,
  variant = "ghost",
  disabled,
  size = "xs",
  className,
}: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function copy() {
    clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      // Never claim success for a write that did not happen —
      // docs/design/anti-patterns.md#13-fake-data-and-fake-success.
      setStatus("failed");
    }
    timerRef.current = setTimeout(() => setStatus("idle"), RESET_MS);
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={copy}
        aria-label={showLabel ? undefined : copyLabel}
        className="cursor-pointer"
      >
        {status === "copied" ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {showLabel && copyLabel}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" ? copiedLabel : status === "failed" ? failedLabel : ""}
      </span>
    </span>
  );
}
