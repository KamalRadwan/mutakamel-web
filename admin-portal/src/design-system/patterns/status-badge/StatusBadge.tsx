"use client";

import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../../lib/cn";
import { resolveStatusTone, type StatusEnumType } from "./tone-map";

export interface StatusBadgeProps {
  status: string;
  enumType?: StatusEnumType;
  customLabelEn?: string;
  customLabelAr?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}

/** Implements docs/components/status-badge.md — see tone-map.ts for the full enum matrix. */
export function StatusBadge({
  status,
  enumType,
  customLabelEn,
  customLabelAr,
  showDot = true,
  size = "sm",
}: StatusBadgeProps) {
  const { lang } = useI18n();
  const tone = resolveStatusTone(status, enumType);
  const label = lang === "ar" ? (customLabelAr ?? tone.labelAr) : (customLabelEn ?? tone.labelEn);
  const hasCustomLabel = lang === "ar" ? Boolean(customLabelAr) : Boolean(customLabelEn);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        tone.bg,
        tone.text,
        tone.border,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden="true" />}
      <span>{label}</span>
      {!tone.known && !hasCustomLabel ? <span aria-hidden="true">(</span> : null}
      {!tone.known && !hasCustomLabel ? (
        <bdi dir="ltr" className="font-mono normal-case tracking-normal">{tone.rawStatus}</bdi>
      ) : null}
      {!tone.known && !hasCustomLabel ? <span aria-hidden="true">)</span> : null}
    </span>
  );
}
