"use client";

import { Search, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface SettingSearchProps {
  value: string;
  onChange: (val: string) => void;
}

export function SettingSearch({ value, onChange }: SettingSearchProps) {
  const { t } = useI18n();

  return (
    <div className="relative w-full sm:w-72">
      <Search className="w-4 h-4 text-muted-foreground absolute top-3 start-3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.settings.search.placeholder}
        className="w-full ps-9 pe-8 py-2 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute top-2.5 end-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
