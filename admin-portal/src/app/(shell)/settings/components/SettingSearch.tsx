"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";
import { Button, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

interface SettingSearchProps {
  value: string;
  onChange: (val: string) => void;
}

export function SettingSearch({ value, onChange }: SettingSearchProps) {
  const { t } = useI18n();
  const inputId = useId();

  return (
    <div className="w-full sm:w-72">
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-foreground">
        {t.settings.search.label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.settings.search.placeholder}
          className="w-full ps-9 pe-8"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange("")}
            aria-label={t.settings.search.clear}
            className="absolute end-1 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
