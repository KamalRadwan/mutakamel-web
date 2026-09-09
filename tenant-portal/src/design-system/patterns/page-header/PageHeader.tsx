"use client";

import { ChevronRight } from "lucide-react";
import { useDictionary } from "@/i18n/useLanguage";
import { cn } from "../../lib/cn";
import { iconSize, mirrorInRtl } from "../../lib/icons";
import { Button, type ButtonProps } from "../../primitives/Button";
import { PageActions } from "../../shell/PageActions";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean; size?: ButtonProps["size"] };
  secondaryActions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  /** Rendered inline after the title — a `StatusBadge`, and nothing that takes focus. */
  titleAdornment?: React.ReactNode;
  /** Rendered before the title block — the detail screens' back control. */
  leading?: React.ReactNode;
  className?: string;
}

/**
 * **The only place a `primary` button may appear.**
 *
 * If a screen seems to need two primary actions, one of them is secondary —
 * see docs/design/DESIGN-SYSTEM.md#4-one-filled-action-per-screen.
 *
 * `DetailHeader` does **not** compete with this rule; it *composes* this
 * component and fills the `leading` and `titleAdornment` slots. There is
 * exactly one implementation of the filled primary in the system, so the two
 * headers cannot drift, and a detail screen renders `DetailHeader` **instead
 * of** `PageHeader`, never both. That is the whole answer to MASTER-PLAN 1.43:
 * `PageHeader` owns the primary action, in both shapes.
 *
 * **The action cluster renders in the page action bar, not here.** The props
 * are unchanged and every screen goes on declaring its actions exactly where it
 * declared them before; a portal moves the resulting DOM up into the shell's
 * second bar — see `shell/page-action-slots.tsx`. Doing it in this one
 * component is what moved 78 screens' actions into the new bar without editing
 * any of them, and it keeps the one-filled-action rule structural: the bar has
 * no `primary` variant of its own to reach for, so the ceiling still holds at
 * exactly one implementation.
 *
 * The heading itself stays on the page. It is the screen's own `<h1>` and the
 * document's outline depends on it; the bar names where you are in the nav,
 * which on a detail screen is a different sentence from the record's name.
 */
export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  breadcrumbs,
  titleAdornment,
  leading,
  className,
}: PageHeaderProps) {
  const t = useDictionary();

  return (
    <div className={cn("flex flex-col gap-1 pb-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label={t.common.breadcrumb} className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className={cn(iconSize({ size: "xs" }), mirrorInRtl)} aria-hidden="true" />
              )}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-foreground hover:underline">
                  {crumb.label}
                </a>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {leading}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              {titleAdornment}
            </div>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {(secondaryActions || primaryAction) && (
          <PageActions slot="actions">
            {secondaryActions}
            {primaryAction && (
              <Button
                variant="primary"
                size={primaryAction.size}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                loading={primaryAction.loading}
              >
                {primaryAction.label}
              </Button>
            )}
          </PageActions>
        )}
      </div>
    </div>
  );
}
