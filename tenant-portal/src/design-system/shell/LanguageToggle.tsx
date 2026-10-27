"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../primitives/Button";
import { cn } from "../lib/cn";

// Shows the target language in its own script — "English" while in Arabic,
// "العربية" while in English — never a translated "switch language", so a
// user can recognise the destination even if they cannot read the current
// language. See docs/design/theming.md#the-toggles.
export function LanguageToggle({ tone = "surface" }: { tone?: "surface" | "chrome" }) {
  const { t, toggleLang } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLang}
      aria-label={t.common.langSwitch}
      className={cn(
        "h-9 w-9 gap-1.5 rounded-full border px-0 sm:w-auto sm:px-3.5",
        tone === "chrome"
          ? "border-nav-chrome-line bg-white/8 text-nav-foreground not-disabled:hover:bg-white/15 not-disabled:hover:text-nav-foreground-strong"
          : "border-line-control bg-surface-subtle text-foreground-secondary not-disabled:hover:bg-accent not-disabled:hover:text-foreground",
      )}
    >
      <Globe className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden text-label font-medium sm:inline">{t.common.langSwitch}</span>
    </Button>
  );
}
