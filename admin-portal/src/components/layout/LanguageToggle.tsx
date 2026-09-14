"use client";

import { Globe } from "lucide-react";
import { Button } from "@/design-system";
import { useLanguageToggle } from "./hooks/useLanguageToggle";

export function LanguageToggle() {
  const { toggleLanguage, title, buttonLabel } = useLanguageToggle();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="h-7 gap-1.5 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold text-slate-200 hover:border-white/25 hover:bg-white/15 hover:text-white"
      aria-label={title}
      title={title}
    >
      <Globe className="size-3.5 text-slate-300" aria-hidden="true" />
      <span>{buttonLabel}</span>
    </Button>
  );
}
