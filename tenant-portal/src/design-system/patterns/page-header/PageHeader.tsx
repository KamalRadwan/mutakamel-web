"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "../../primitives/Button";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  secondaryActions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
}

// The only place a primary button may appear. If a screen seems to need two
// primary actions, one of them is secondary — see
// docs/design/DESIGN-SYSTEM.md#4-one-filled-action-per-screen.
export function PageHeader({ title, description, primaryAction, secondaryActions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3 rtl:-scale-x-100" aria-hidden="true" />}
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {secondaryActions}
          {primaryAction && (
            <Button variant="primary" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
