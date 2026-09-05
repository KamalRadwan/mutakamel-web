"use client";

import { Megaphone } from "lucide-react";
import { cn } from "@/design-system";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";

/** Tile steps: `sm` sits in a picker row, `md` in the catalogue table. */
const TILE = { sm: "size-5", md: "size-7" } as const;
const GLYPH = { sm: "size-3.5", md: "size-4" } as const;

export interface AcquisitionSourceIconProps {
  /**
   * `null` is a picker's "no source" entry — not a source at all, so it gets
   * an empty tile rather than the megaphone. Without one, its label would
   * start further inline-start than every source listed under it.
   */
  source: Pick<AcquisitionSource, "iconUrl"> | null;
  size?: keyof typeof TILE;
}

/**
 * A source's uploaded icon, or the mark that stands in for one.
 *
 * A raw <img>, deliberately: `iconUrl` is an opaque, cache-busted server path
 * served by `GET /:id/icon` under the same session cookie, and next/image
 * cannot serve it — the route streams `private, no-store` bytes behind auth.
 * Radix `Avatar` is out for the same reason and not the obvious one: it probes
 * the URL with a request of its own before rendering the one you see, and
 * `no-store` means neither answer is ever reused.
 *
 * Decorative in every position (`alt=""`), because the source's name is always
 * rendered beside it — an announced icon would say it twice.
 */
export function AcquisitionSourceIcon({ source, size = "sm" }: AcquisitionSourceIconProps) {
  let mark: React.ReactNode = null;
  if (source?.iconUrl) {
    mark = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.iconUrl}
        alt=""
        className={cn(TILE[size], "object-contain")}
        loading="lazy"
      />
    );
  } else if (source) {
    mark = (
      <Megaphone
        className={cn(GLYPH[size], "text-brand-600 dark:text-brand-400")}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted",
        TILE[size],
      )}
    >
      {mark}
    </span>
  );
}

export interface AcquisitionSourceOptionProps {
  source: Pick<AcquisitionSource, "iconUrl"> | null;
  label: string;
}

/**
 * One row of a source picker: the icon, then the name.
 *
 * Wrapped in a single element on purpose. Radix clones a selected item's text
 * into the trigger, and `SelectTrigger` line-clamps its direct span children —
 * which turns that span into a vertical `-webkit-box`. Two children there
 * would stack the icon above the name in the trigger; one flex child lays out
 * the same way in the list and in the trigger.
 */
export function AcquisitionSourceOption({ source, label }: AcquisitionSourceOptionProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AcquisitionSourceIcon source={source} />
      <span className="truncate">{label}</span>
    </span>
  );
}
