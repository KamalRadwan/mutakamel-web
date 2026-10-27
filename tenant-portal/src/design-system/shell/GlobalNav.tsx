"use client";

import { Menu } from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
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
  const { user } = useTenantAuth();

  return (
    <>
      <div
        aria-hidden="true"
        className="h-(--size-brand-strip) w-full shrink-0 bg-gradient-brand-strip print:hidden"
      />
      <header className="nav-surface flex h-(--size-topbar) shrink-0 items-center border-b border-nav-chrome-line bg-gradient-header px-[22px] text-nav-foreground-strong print:hidden">
        <div className="flex min-w-0 shrink items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="size-9 rounded-lg px-0 text-nav-foreground not-disabled:hover:bg-white/10 not-disabled:hover:text-nav-foreground-strong lg:hidden"
            onClick={onMobileMenuOpen}
            aria-label={t.nav.openNavigation}
          >
            <Menu className="size-4" aria-hidden="true" />
          </Button>
          <BrandMark />
        </div>
        <span
          aria-hidden="true"
          className="mx-2.5 hidden select-none text-xs text-nav-foreground/35 sm:inline"
        >
          /
        </span>
        <div className="flex shrink-0 items-center">
          {/* It scopes every menu that follows it, so it reads and tabs first. */}
          <AppSwitcher apps={apps} activeApp={activeApp} onSelect={onAppSelect} />
          <Separator
            orientation="vertical"
            className="mx-3 hidden h-5 w-0 border-s border-nav-chrome-line bg-transparent lg:block"
          />
        </div>
        <nav
          aria-label={t.nav.mainNavigation}
          className="scrollbar-none hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex"
        >
          {sections.map((section) => (
            <NavMenu key={section.id} section={section} activeItemId={activeItemId} />
          ))}
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-2 ps-3">
          <LanguageToggle tone="chrome" />
          <ThemeToggle tone="chrome" />
          {can(user, "notifications.notification.read") && <NotificationsDropdown />}
          <UserMenu />
        </div>
      </header>
    </>
  );
}
