"use client";

import { Globe } from "lucide-react";
import { useLanguageToggle } from "./hooks/useLanguageToggle";

export function LanguageToggle() {
  const { toggleLanguage, title, buttonLabel } = useLanguageToggle();

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground dark:hover:bg-ink-800"
      title={title}
    >
      <Globe className="size-3.5" aria-hidden="true" />
      <span>{buttonLabel}</span>
    </button>
  );
}
