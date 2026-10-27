"use client";

import { Globe } from "lucide-react";
import { Button, cn } from "@/design-system";
import { useLanguageToggle } from "./hooks/useLanguageToggle";

export function LanguageToggle({ tone = "surface" }: { tone?: "surface" | "chrome" }) {
  const { toggleLanguage, title, buttonLabel } = useLanguageToggle();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className={cn(
        "h-9 shrink-0 gap-1.5 rounded-full border px-3",
        tone === "chrome"
          ? "border-nav-chrome-line bg-white/5 text-nav-foreground hover:bg-white/10 hover:text-nav-foreground-strong"
          : "border-line-control bg-surface-subtle text-foreground-secondary hover:bg-accent hover:text-foreground",
      )}
      aria-label={title}
      title={title}
    >
      <Globe className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-label font-medium">{buttonLabel}</span>
    </Button>
  );
}
