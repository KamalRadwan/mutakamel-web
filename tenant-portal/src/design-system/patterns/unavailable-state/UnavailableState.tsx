"use client";

import Link from "next/link";
import { Construction } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../../primitives/Button";

export interface UnavailableStateProps {
  backHref: string;
}

// Renders instead of a route with no server contract behind it — never
// fabricated data or a fake success state. See docs/design/anti-patterns.md.
export function UnavailableState({ backHref }: UnavailableStateProps) {
  const { t } = useI18n();

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-card p-8">
        <Construction className="size-10 text-caution-500" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">{t.unavailable.title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{t.unavailable.description}</p>
        <Button variant="primary" asChild>
          <Link href={backHref}>{t.unavailable.back}</Link>
        </Button>
      </div>
    </section>
  );
}
