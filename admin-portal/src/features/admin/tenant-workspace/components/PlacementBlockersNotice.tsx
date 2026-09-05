"use client";

import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { describeTenantPlacementBlocker } from "../placement-blockers";

/**
 * Renders every reason a placement move is refused right now.
 *
 * Deliberately additive, not a replacement for the page: Core reports blockers
 * instead of throwing so the operator can see what to clear, and hiding the
 * wizard behind this notice would take that away.
 */
export function PlacementBlockersNotice({
  blockers,
  title,
  description,
}: {
  blockers: readonly string[];
  title: string;
  description: string;
}) {
  const { lang } = useI18n();
  if (blockers.length === 0) return null;

  return (
    <section
      role="alert"
      className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-warning-subtle-foreground"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5">{description}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-3 ps-8">
        {blockers.map((code) => {
          const blocker = describeTenantPlacementBlocker(code, lang);
          return (
            <li key={code}>
              <p className="text-sm font-medium">{blocker.title}</p>
              <p className="mt-0.5 text-xs leading-5">{blocker.explanation}</p>
              <bdi dir="ltr" className="mt-1 block font-mono text-xs opacity-80">
                {blocker.code}
              </bdi>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
