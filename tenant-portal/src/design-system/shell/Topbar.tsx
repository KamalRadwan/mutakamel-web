"use client";

import { Menu } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../primitives/Button";
import { AppSwitcher } from "./AppSwitcher";
import type { NavApp, NavAppId } from "./nav-config";
import { Separator } from "../primitives/Separator";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export interface TopbarProps {
  onMobileMenuOpen: () => void;
  /** The three apps, each carrying its permission-filtered section list. */
  apps: NavApp[];
  activeApp: NavAppId;
  onAppSelect: (app: NavAppId) => void;
}

// 48px, one height token (--size-topbar) used everywhere — fixes D6's three
// conflicting hard-coded heights. It reads 48 rather than the 44 written here
// before because --size-topbar became admin's h-12 with the geometry port; the
// point of the token is that this comment is the only thing that had to change.
// No search here: search belongs to a workspace's own FilterBar, scoped to that
// workspace's data.
export function Topbar({ onMobileMenuOpen, apps, activeApp, onAppSelect }: TopbarProps) {
  const { t } = useI18n();

  return (
    <header className="flex h-(--size-topbar) shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 print:hidden">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMobileMenuOpen} aria-label={t.nav.workspaceCenter}>
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        {/* First control in the topbar. It scopes the whole sidebar below it,
            so it reads and tabs before anything it scopes. The sidebar's own
            head stays reserved for the logo. */}
        <AppSwitcher apps={apps} activeApp={activeApp} onSelect={onAppSelect} />
      </div>
      <div className="flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
        <NotificationsDropdown />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserMenu />
      </div>
    </header>
  );
}
