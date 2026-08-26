"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Dialog, DialogContent, DialogTitle } from "../primitives/Dialog";
import { cn } from "../lib/cn";
import type { NavSection } from "./nav-config";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSection[];
  onNavigate: (href: string) => void;
}

export function CommandPalette({ open, onOpenChange, sections, onNavigate }: CommandPaletteProps) {
  const { lang } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-xl p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{lang === "ar" ? "بحث سريع" : "Quick search"}</DialogTitle>
        <Command loop className="flex flex-col" shouldFilter>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              autoFocus
              placeholder={lang === "ar" ? "ابحث عن صفحة..." : "Search pages..."}
              className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="p-6 text-center text-xs text-muted-foreground">
              {lang === "ar" ? "لا توجد نتائج" : "No results found"}
            </Command.Empty>
            {sections.map((section) => (
              <Command.Group
                key={section.key}
                heading={section.labelKey ? (lang === "ar" ? section.labelKey.ar : section.labelKey.en) : undefined}
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/80"
              >
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const label = lang === "ar" ? item.labelKey.ar : item.labelKey.en;
                  return (
                    <Command.Item
                      key={item.key}
                      value={`${label} ${item.href}`}
                      onSelect={() => onNavigate(item.href)}
                      className={cn(
                        "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm text-foreground outline-none",
                        "data-[selected=true]:bg-ink-100 dark:data-[selected=true]:bg-ink-800",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
