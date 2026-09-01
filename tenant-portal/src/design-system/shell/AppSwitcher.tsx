"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../primitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/DropdownMenu";
import type { NavApp, NavAppId, NavSection } from "./nav-config";

export interface AppSwitcherProps {
  /** The three apps, each carrying its PERMISSION-FILTERED section list. */
  apps: NavApp[];
  activeApp: NavAppId;
  onSelect: (app: NavAppId) => void;
}

const firstHref = (sections: NavSection[]): string | undefined =>
  sections.find((section) => section.items.length > 0)?.items[0]?.href;

/**
 * The app switcher at the start of the topbar.
 *
 * Built on the design system's `DropdownMenu`, as a radio group: "which app am
 * I in" is a single-choice question, and the radio items carry `aria-checked`
 * for free rather than needing a hand-rolled current-item affordance.
 *
 * Selecting an app both records the preference AND navigates into that app.
 * Recording alone would look broken from an app-owned route: `useActiveApp`
 * derives from the route first, so choosing Trade while standing on
 * `/crm/leads` would set a preference the route immediately outranks, and the
 * sidebar would not move. Navigation is what makes the choice take effect.
 *
 * An app the actor can reach nothing in is listed but disabled — it stays
 * visible so the product's shape is legible, and unselectable because there is
 * no screen to land on. A tenant without the Trade module sees Trade greyed,
 * not missing.
 */
export function AppSwitcher({ apps, activeApp, onSelect }: AppSwitcherProps) {
  const { t } = useI18n();
  const router = useRouter();

  const label = (app: NavApp) => t.nav[app.labelKey as keyof typeof t.nav] as string;

  const active = apps.find((app) => app.id === activeApp) ?? apps[0];
  if (!active) return null;

  const ActiveIcon = active.icon;

  function handleSelect(next: string) {
    const target = apps.find((app) => app.id === next);
    if (!target) return;
    onSelect(target.id);
    const href = firstHref(target.sections);
    if (href) router.push(href);
  }

  // Sized for the topbar, not the sidebar: no `w-full` (the topbar is a row,
  // not a column) and `text-foreground` rather than `text-sidebar-foreground`,
  // because this sits on `bg-card` now. The app label hides on the narrowest
  // widths so the icon and the topbar's own controls still fit.
  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t.nav.appSwitcher}
      className="justify-between gap-2 text-foreground"
    >
      <span className="flex min-w-0 items-center gap-2">
        <ActiveIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden truncate font-medium sm:inline">{label(active)}</span>
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Button>
  );

  return (
    <DropdownMenu>
      {/* In the icon rail the trigger has no visible text, so the tooltip
          carries the current app the way every rail item does. The trigger is
          a real button either way, so Tab reaches it and Enter opens the menu
          — the rail loses the label, never the keyboard path. */}
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-(--size-sidebar)">
        <DropdownMenuLabel>{t.nav.appSwitcher}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={activeApp} onValueChange={handleSelect}>
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <DropdownMenuRadioItem
                key={app.id}
                value={app.id}
                disabled={firstHref(app.sections) === undefined}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {label(app)}
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
