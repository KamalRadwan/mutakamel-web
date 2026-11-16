"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../primitives/Sheet";
import { CRM_SETTINGS_GROUPS } from "./crm-settings-navigation";
import type { NavSection } from "./nav-config";

interface SettingsLinksProps {
  section?: NavSection;
  activeItemId: string | null;
  onNavigate?: () => void;
}

function SettingsLinks({ section, activeItemId, onNavigate }: SettingsLinksProps) {
  const { t } = useI18n();
  return (
    <nav aria-label={t.crmSettingsNavigation.sections} className="flex flex-col gap-4">
      {CRM_SETTINGS_GROUPS.map((group) => {
        const items = section?.items.filter((item) => (group.ids as readonly string[]).includes(item.id)) ?? [];
        if (!items.length) return null;
        return (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.crmSettingsNavigation[group.label]}
            </p>
            {items.map((item) => {
              const selected = item.id === activeItemId;
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href} onClick={onNavigate}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-accent",
                    "before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-transparent",
                    focusRing,
                    selected && "bg-sidebar-selected font-semibold text-sidebar-selected-foreground before:bg-sidebar-active hover:bg-sidebar-selected",
                  )}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 whitespace-normal leading-relaxed">
                    {t.nav[item.labelKey as keyof typeof t.nav]}
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function CrmSettingsAside(props: SettingsLinksProps) {
  const { t } = useI18n();
  return (
    <aside aria-label={t.nav.crmSettings} className="hidden w-60 shrink-0 flex-col gap-6 overflow-y-auto border-e border-sidebar-border bg-card p-3 lg:flex">
      <div className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-foreground">
        <Settings className="size-4 text-primary" aria-hidden="true" />
        {t.nav.crmSettings}
      </div>
      <SettingsLinks {...props} />
      <p className="mt-auto border-t border-border px-3 pt-4 text-xs text-muted-foreground">
        {t.crmSettingsNavigation.workspaceConfiguration}
      </p>
    </aside>
  );
}

export function CrmSettingsSheet({ open, onOpenChange, ...props }: SettingsLinksProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent id="crm-settings-sections" side="start" className="w-80 max-w-full overflow-y-auto p-3 sm:max-w-sm">
        <SheetTitle className="pe-8 text-base">{t.nav.crmSettings}</SheetTitle>
        <SheetDescription className="text-xs">{t.crmSettingsNavigation.description}</SheetDescription>
        <SettingsLinks {...props} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
