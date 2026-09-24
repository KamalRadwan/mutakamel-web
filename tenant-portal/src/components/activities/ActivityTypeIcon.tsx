"use client";

import { cn, iconSize } from "@/design-system";
import { activityTypeIcon } from "./activity-presentation";

export interface ActivityTypeIconProps {
  type: string;
  /** The `iconSize` step of the control or line the glyph sits in. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * The glyph of an activity type. Decorative by contract: it always sits beside
 * the type's label, which is what a screen reader reads.
 */
export function ActivityTypeIcon({ type, size = "sm", className }: ActivityTypeIconProps) {
  const { icon: Icon, isFallback } = activityTypeIcon(type);
  // The fallback is the `Activity` pulse line, a stroke glyph that needs the
  // heavier weight at the small steps to read as a mark — docs/design/icons.md.
  const heavy = isFallback && (size === "xs" || size === "sm" || size === "md");
  return <Icon className={cn(iconSize({ size }), className)} strokeWidth={heavy ? 2.5 : undefined} aria-hidden="true" />;
}
