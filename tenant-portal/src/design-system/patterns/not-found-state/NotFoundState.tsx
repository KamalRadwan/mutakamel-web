"use client";

import Link from "next/link";
import { FileX } from "lucide-react";
import { cn } from "../../lib/cn";
import { proseMeasure } from "../../lib/variants";
import { Button } from "../../primitives/Button";

export interface NotFoundStateProps {
  title: string;
  description?: string;
  backLabel: string;
  /** Route back to the list. Ignored when onBack is given. */
  backHref?: string;
  /** Used when the caller must run its own navigation instead of a Link. */
  onBack?: () => void;
  className?: string;
}

// A record that is gone — deleted, or reached from a stale link or a
// bookmarked id. Deliberately distinct from ErrorState and deliberately
// WITHOUT a retry button: the request did not fail, it succeeded and the
// answer was "this no longer exists". A retry can never change that, and
// offering one tells the user to keep pressing a button that cannot work.
export function NotFoundState({
  title,
  description,
  backLabel,
  backHref,
  onBack,
  className,
}: NotFoundStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center",
        className,
      )}
    >
      <FileX className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className={cn("text-xs text-muted-foreground", proseMeasure)}>{description}</p>}
      {onBack ? (
        <Button variant="outline" size="sm" onClick={onBack} className="mt-2">
          {backLabel}
        </Button>
      ) : (
        backHref && (
          <Button variant="outline" size="sm" asChild className="mt-2">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        )
      )}
    </div>
  );
}
