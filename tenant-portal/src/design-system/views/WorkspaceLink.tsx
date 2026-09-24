"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/Tooltip";

export interface WorkspaceLinkProps {
  href: string;
  /** Accessible name and tooltip — the destination, e.g. "Lead activities". */
  label: string;
  icon: LucideIcon;
}

/**
 * A jump to a related workspace, placed after the `ViewSwitcher` in the page
 * action bar's `view` slot.
 *
 * It wears the switcher's frame so the two read as one cluster of icon
 * controls, but it is a link, never another radio: a radio would promise a
 * different drawing of the SAME records, and this leaves for other records.
 * It keeps the switcher's 28px target and its tooltip rule — an icon-only
 * control always carries its name in both `aria-label` and a tooltip.
 */
export function WorkspaceLink({ href, label, icon: Icon }: WorkspaceLinkProps) {
  return (
    <span className="inline-flex items-center rounded-sm border border-border bg-card p-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            aria-label={label}
            className={cn(
              "flex size-7 items-center justify-center rounded-xs text-muted-foreground",
              "hover:bg-accent hover:text-foreground",
              focusRing,
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </span>
  );
}
