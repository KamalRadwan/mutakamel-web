"use client";

import Link from "next/link";
import { Construction } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../../lib/cn";
import { proseMeasure } from "../../lib/variants";
import { Button } from "../../primitives/Button";

export interface UnavailableStateProps {
  backHref: string;
  copy?: { title: string; description: string; back: string };
}

// Renders instead of a route with no server contract behind it — never
// fabricated data or a fake success state. See docs/design/anti-patterns.md.
export function UnavailableState({ backHref, copy }: UnavailableStateProps) {
  const { t } = useI18n();
  const unavailable = copy ?? t.unavailable;

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-card p-8">
        <Construction className="size-10 text-caution-500" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">{unavailable.title}</h1>
        <p className={cn("text-sm leading-6 text-muted-foreground", proseMeasure)}>{unavailable.description}</p>
        <Button size="sm" variant="primary" asChild>
          <Link href={backHref}>{unavailable.back}</Link>
        </Button>
      </div>
    </section>
  );
}
