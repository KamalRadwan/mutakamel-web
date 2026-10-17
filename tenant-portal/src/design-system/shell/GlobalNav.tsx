"use client";

import { Menu } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../primitives/Button";
import { Separator } from "../primitives/Separator";
import { AppSwitcher } from "./AppSwitcher";
import { BrandMark } from "./BrandMark";
import { LanguageToggle } from "./LanguageToggle";
import { NavMenu } from "./NavMenu";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import type { NavApp, NavAppId, NavSection } from "./nav-config";

export interface GlobalNavProps {
  onMobileMenuOpen: () => void;
  /** The three apps, each carrying its permission-filtered section list. */
  apps: NavApp[];
  activeApp: NavAppId;
  onAppSelect: (app: NavAppId) => void;
  /** The active app's sections — one menu each. */
  sections: NavSection[];
  /** The item the current route resolves to, for the active-section marker. */
  activeItemId: string | null;
}

export function GlobalNav({
  onMobileMenuOpen,
  apps,
  activeApp,
  onAppSelect,
  sections,
  activeItemId,
}: GlobalNavProps) {
  const { t } = useI18n();

  return (
    <header className="nav-surface flex h-(--size-topbar) shrink-0 items-center border-b-2 border-[#38bdf8] bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#172554] pe-2.5 text-white shadow-[0_2px_8px_rgba(15,23,42,0.18)] dark:border-[#3b82f6] dark:from-[#0b1120] dark:via-[#131c38] dark:to-[#0f172a] print:hidden">
      <div className="flex h-full shrink-0 items-center ps-1 lg:ps-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 px-0 text-white hover:bg-white/10 hover:text-white lg:hidden"
          onClick={onMobileMenuOpen}
          aria-label={t.nav.openNavigation}
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        <BrandMark />
      </div>
      <span
        aria-hidden="true"
        className="hidden select-none text-xs text-white/30 sm:inline"
      >
        /
      </span>
      <div className="flex shrink-0 items-center gap-1.5 ps-1.5 sm:ps-2">
        {/* It scopes every menu that follows it, so it reads and tabs first. */}
        <AppSwitcher apps={apps} activeApp={activeApp} onSelect={onAppSelect} />
        <Separator orientation="vertical" className="mx-0.5 hidden h-4 bg-white/15 lg:block" />
      </div>
      <nav
        aria-label={t.nav.mainNavigation}
        className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto ps-1 lg:flex xl:gap-1.5"
      >
        {sections.map((section) => (
          <NavMenu key={section.id} section={section} activeItemId={activeItemId} />
        ))}
      </nav>
      <div className="ms-auto flex shrink-0 items-center gap-2 ps-2">
        <div className="flex items-center gap-0.5 rounded-md border border-white/15 bg-white/10 px-1 text-white">
          <LanguageToggle />
          <ThemeToggle />
          <NotificationsDropdown />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
