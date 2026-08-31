"use client";

import { Globe } from "lucide-react";
import { Button } from "@/design-system";
import { useLanguageToggle } from "./hooks/useLanguageToggle";

export function LanguageToggle() {
  const { toggleLanguage, title, buttonLabel } = useLanguageToggle();

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      onClick={toggleLanguage}
      className="gap-1.5 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      aria-label={title}
      title={title}
    >
      <Globe className="size-3.5" aria-hidden="true" />
      <span>{buttonLabel}</span>
    </Button>
  );
}
