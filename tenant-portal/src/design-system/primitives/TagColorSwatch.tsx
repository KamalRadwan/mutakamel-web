"use client";

import { cn } from "../lib/cn";
import { toTagColor } from "./tag-color";

interface TagColorPairProps {
  backgroundColor?: string | null;
  textColor?: string | null;
}

/** The same validated tenant-owned pair as TagChip, without repeating its label. */
export function TagColorSwatch({ backgroundColor, textColor, label }: TagColorPairProps & { label: string }) {
  const color = toTagColor(backgroundColor, textColor);
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex h-6 w-8 shrink-0 items-center">
      <span aria-hidden="true" className={cn("size-4 rounded-sm border border-border", !color && "border-dashed bg-card")}
        style={color ? { backgroundColor: color.backgroundColor } : undefined} />
      <span aria-hidden="true" className={cn("-ms-1 mt-2 size-4 rounded-sm border border-border", !color && "border-dashed bg-muted")}
        style={color ? { backgroundColor: color.textColor } : undefined} />
    </span>
  );
}

export function TagColorMark({ backgroundColor, textColor }: TagColorPairProps) {
  const color = toTagColor(backgroundColor, textColor);
  return (
    <span aria-hidden="true" className={cn("h-5 w-1 shrink-0 rounded-full border", !color && "border-border bg-muted-foreground/30")}
      style={color ? { backgroundColor: color.backgroundColor, borderColor: color.textColor } : undefined} />
  );
}
