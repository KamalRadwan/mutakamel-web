"use client";

import { Card, cn } from "@/design-system";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export interface AuthShellProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  cardClassName?: string;
}

/** Shared, bilingual shell for every public authentication workflow. */
export function AuthShell({ children, footer, cardClassName }: AuthShellProps) {
  return (
    <main
      id="auth-main"
      tabIndex={-1}
      className="grid min-h-dvh grid-rows-[auto_1fr_auto] bg-background p-4 text-foreground sm:p-6"
    >
      <div className="flex min-w-0 items-center justify-end gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="flex min-w-0 items-center justify-center py-6 sm:py-8">
        <Card
          className={cn(
            "w-full max-w-md border-border bg-card p-6 shadow-pop sm:p-8",
            cardClassName,
          )}
        >
          {children}
        </Card>
      </div>

      {footer ? (
        <footer className="min-w-0 text-center text-xs text-muted-foreground">
          {footer}
        </footer>
      ) : (
        <span aria-hidden="true" />
      )}
    </main>
  );
}
