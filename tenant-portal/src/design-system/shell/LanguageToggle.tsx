"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../primitives/Button";

// Shows the target language in its own script — "English" while in Arabic,
// "العربية" while in English — never a translated "switch language", so a
// user can recognise the destination even if they cannot read the current
// language. See docs/design/theming.md#the-toggles.
export function LanguageToggle() {
  const { t, toggleLang } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLang}
      aria-label={t.common.langSwitch}
      className="h-6 gap-1 px-1.5 text-xs text-white/90 hover:bg-white/15 hover:text-white"
    >
      <Globe className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{t.common.langSwitch}</span>
    </Button>
  );
}
