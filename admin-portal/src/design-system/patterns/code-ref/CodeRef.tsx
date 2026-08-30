"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";

/**
 * One component owns dir="ltr" + mono + select-all + copy for every
 * correlationId/errorCode/checksum/key in the app (~40 sites). Small,
 * high-leverage — see docs/design-system/migration.md Phase 12.
 */
export function CodeRef({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const { lang } = useI18n();

  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={copy}
      dir="ltr"
      aria-label={
        copied
          ? lang === "ar" ? "تم نسخ المرجع" : "Reference copied"
          : lang === "ar" ? `نسخ المرجع ${value}` : `Copy reference ${value}`
      }
      className={cn(
        "h-auto max-w-full gap-1 whitespace-normal rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-accent",
        className,
      )}
      title={value}
    >
      <span className="select-all truncate">{value}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-60" aria-hidden="true" />
      )}
    </Button>
  );
}
