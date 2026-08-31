"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button, LanguageToggle, ThemeToggle, cn, proseMeasure } from "@/design-system";

interface FenceAction {
  label: string;
  href: string;
}

interface FenceScreenProps {
  icon: LucideIcon;
  tone: "caution" | "negative" | "neutral";
  title: string;
  description: string;
  /** Rendered under the description — the specific reason, when one is known. */
  detail?: React.ReactNode;
  primaryAction: FenceAction;
  secondaryAction?: FenceAction;
}

const ICON_TONE = {
  caution: "text-caution-600 dark:text-caution-400",
  negative: "text-negative-600 dark:text-negative-400",
  neutral: "text-muted-foreground",
} as const;

/**
 * The chrome every terminal fence shares — session expiry, a suspended account,
 * a maintenance window, a blocked entitlement.
 *
 * These are the four screens a user reaches with no shell around them, so each
 * one carries the language and theme toggles itself: a user locked out in the
 * wrong language has no other way to change it.
 */
export function FenceScreen({
  icon: Icon,
  tone,
  title,
  description,
  detail,
  primaryAction,
  secondaryAction,
}: FenceScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas p-4">
      <div className="flex justify-end gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center py-8">
        <div
          role="alert"
          className="flex w-full max-w-prose flex-col items-center gap-3 rounded-md border border-border bg-card p-8 text-center"
        >
          <Icon className={cn("size-8", ICON_TONE[tone])} aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className={cn("text-sm text-muted-foreground", proseMeasure)}>{description}</p>
          {detail}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="primary" size="sm" asChild>
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
            {secondaryAction ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
