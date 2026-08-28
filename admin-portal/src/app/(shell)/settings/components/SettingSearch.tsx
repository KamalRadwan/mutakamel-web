"use client";

import { Search, X } from "lucide-react";
import { Button, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

interface SettingSearchProps {
  value: string;
  onChange: (val: string) => void;
}

export function SettingSearch({ value, onChange }: SettingSearchProps) {
  const { t } = useI18n();

  return (
    <div className="relative w-full sm:w-72">
      <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 start-3 -translate-y-1/2 pointer-events-none" />
      <Input
        type="text"
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
          className="absolute end-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
