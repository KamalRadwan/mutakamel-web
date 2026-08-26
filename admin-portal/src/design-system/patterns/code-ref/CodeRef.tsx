"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * One component owns dir="ltr" + mono + select-all + copy for every
 * correlationId/errorCode/checksum/key in the app (~40 sites). Small,
 * high-leverage — see docs/design-system/migration.md Phase 12.
 */
export function CodeRef({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      dir="ltr"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm bg-ink-100 px-1.5 py-0.5 font-mono text-2xs text-ink-700 transition-colors hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700",
        className,
      )}
      title={value}
    >
      <span className="select-all truncate">{value}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-60" aria-hidden="true" />
      )}
    </button>
  );
}
