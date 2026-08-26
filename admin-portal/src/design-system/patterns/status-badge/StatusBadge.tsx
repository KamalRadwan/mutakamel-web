"use client";

import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../../lib/cn";
import { resolveStatusTone } from "./tone-map";

export interface StatusBadgeProps {
  status: string;
  /** Reserved for a future per-entity status vocabulary; not yet wired to
   *  distinct tone tables (matches the pre-migration component's behavior). */
  enumType?: "tenant" | "user" | "subscription" | "invoice" | "operation" | "db-server";
  customLabelEn?: string;
  customLabelAr?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}

/** Implements docs/components/status-badge.md — see tone-map.ts for the full enum matrix. */
export function StatusBadge({
  status,
  customLabelEn,
  customLabelAr,
  showDot = true,
  size = "sm",
}: StatusBadgeProps) {
  const { lang } = useI18n();
  const tone = resolveStatusTone(status);
  const label = lang === "ar" ? (customLabelAr ?? tone.labelAr) : (customLabelEn ?? tone.labelEn);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        tone.bg,
        tone.text,
        tone.border,
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
