"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/cn";
import { iconSize, mirrorInRtl } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import { PageHeader, type PageHeaderProps } from "../page-header/PageHeader";

export interface DetailHeaderProps
  extends Pick<PageHeaderProps, "title" | "primaryAction" | "secondaryActions" | "breadcrumbs" | "className"> {
  /** Type · source · owner — the one line that identifies the record beyond its name. */
  subtitle?: string;
  /** A `StatusBadge`. Nothing focusable: it sits inside the heading line. */
  status?: React.ReactNode;
  backLabel: string;
  /** Route back to the list. Ignored when `onBack` is given. */
  backHref?: string;
  /** For a caller that must run its own navigation — a drawer close, a router.back(). */
  onBack?: () => void;
}

/**
 * The header every detail screen in phases 4–12 uses.
 *
 * **It composes `PageHeader` rather than reimplementing it**, which is the
 * resolution of MASTER-PLAN 1.43: there is one filled-primary implementation
 * in the system and `PageHeader` owns it. A detail screen renders
 * `DetailHeader` **instead of** `PageHeader` — never both — so the
 * one-filled-primary-per-screen ceiling holds by construction rather than by
 * review.
 *
 * The ceiling is a ceiling, not a quota. `detail-screens.md` is explicit that
 * an `INDIVIDUAL` customer profile simply has no primary action; do not promote
 * Edit to fill the slot.
 */
export function DetailHeader({
  title,
  subtitle,
  status,
  backLabel,
  backHref,
  onBack,
  primaryAction,
  secondaryActions,
  breadcrumbs,
  className,
}: DetailHeaderProps) {
  const backIcon = (
    <ArrowLeft className={cn(iconSize({ size: "lg" }), mirrorInRtl)} aria-hidden="true" />
  );

  return (
    <PageHeader
      title={title}
      description={subtitle}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      breadcrumbs={breadcrumbs}
      titleAdornment={status}
      className={className}
      leading={
        onBack ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={backLabel}
            onClick={onBack}
            className="mt-0.5 shrink-0 cursor-pointer"
          >
            {backIcon}
          </Button>
        ) : backHref ? (
          <Button variant="ghost" size="sm" asChild className="mt-0.5 shrink-0 cursor-pointer">
            <Link href={backHref} aria-label={backLabel}>
              {backIcon}
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}
