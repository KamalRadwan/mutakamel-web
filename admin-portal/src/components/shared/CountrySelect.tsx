"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Country } from "country-state-city";
import { Search, ChevronDown, Check, Globe } from "lucide-react";

interface CountrySelectProps {
  value: string; // ISO code or "ALL"
  onChange: (isoCode: string) => void;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function CountrySelect({
  value,
  onChange,
  placeholder = "اختر الدولة...",
  allowAll = false,
  allLabel = "جميع الدول",
  searchPlaceholder = "بحث عن دولة...",
  emptyLabel = "لا توجد نتائج مطابقة",
  disabled = false,
  className = "",
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const allCountries = useMemo(() => Country.getAllCountries(), []);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return allCountries;
    const query = search.toLowerCase().trim();
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.isoCode.toLowerCase().includes(query),
    );
  }, [allCountries, search]);

  const selectedCountry = useMemo(() => {
    if (value === "ALL" || !value) return null;
    return allCountries.find((c) => c.isoCode === value) || null;
  }, [allCountries, value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-lg text-foreground flex items-center justify-between gap-2 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 min-w-[160px]"
      >
        <div className="flex items-center gap-1.5 truncate">
          {value === "ALL" || !value ? (
            <>
              <Globe className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span className="truncate">
                {allowAll && value === "ALL" ? allLabel : placeholder}
              </span>
            </>
          ) : selectedCountry ? (
            <>
              <span className="text-sm shrink-0">{selectedCountry.flag}</span>
              <span className="truncate">
                {selectedCountry.name} ({selectedCountry.isoCode})
              </span>
            </>
          ) : (
            <span>{value}</span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu - Positioned ALWAYS Downwards (top-full mt-1) */}
      {isOpen && !disabled && (
        <div className="absolute top-full start-0 mt-1 w-full min-w-[220px] max-w-[300px] bg-card border border-border rounded-lg shadow-pop z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar at Top */}
          <div className="p-2 border-b border-border bg-ink-100/50 dark:bg-ink-800/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute top-2.5 start-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full ps-8 pe-2 py-1.5 text-xs bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-brand-500"
                autoFocus
              />
            </div>
          </div>

          {/* Scrollable Countries List */}
          <div className="max-h-56 overflow-y-auto py-1 text-xs divide-y divide-border">
            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onChange("ALL");
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full px-3 py-2 text-start flex items-center justify-between hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors ${
                  value === "ALL"
                    ? "font-semibold text-brand-700 dark:text-brand-400 bg-brand-50/60 dark:bg-brand-950/30"
                    : "text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-brand-500" />
                  <span>{allLabel}</span>
                </div>
                {value === "ALL" && (
                  <Check className="w-3.5 h-3.5 text-brand-600" />
                )}
              </button>
            )}

            {filteredCountries.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted-foreground text-xs">
                {emptyLabel}
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = value === c.isoCode;
                return (
                  <button
                    key={c.isoCode}
                    type="button"
                    onClick={() => {
                      onChange(c.isoCode);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3 py-2 text-start flex items-center justify-between hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors ${
                      isSelected
                        ? "font-semibold text-brand-700 dark:text-brand-400 bg-brand-50/60 dark:bg-brand-950/30"
                        : "text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm shrink-0">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({c.isoCode})
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-brand-600 shrink-0 ms-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
