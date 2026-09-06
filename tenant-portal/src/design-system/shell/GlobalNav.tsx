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

/**
 * The first bar: brand, app, and the active app's sections.
 *
 * ```text
 * [ logo · tenant  250px │ App ▾ │ Section ▾  Section ▾  … ]    [🌐 ☀ 🔔 │ 👤]
 * ```
 *
 * **Why the menus appear at `xl` and not `lg`.** The fixed costs are the 250px
 * brand zone, the app switcher and the account cluster — roughly 570px before a
 * single section is drawn. Trade's six triggers need about 600px. At 1280px
 * that fits with room to spare; at 1024px it does not, and the honest choices
 * there are a clipped row, a horizontal scrollbar inside a 45px bar, or the
 * sheet. The sheet shows every section with its full heading, so that is the
 * one this takes. It also matches what the old shell did at the same width,
 * where `lg`–`xl` defaulted the sidebar to its icon rail.
 *
 * The account controls keep the order they had in the topbar — language, theme,
 * notifications, separator, user — because WCAG's consistent-help expects the
 * same controls in the same order on every route, and moving them here would
 * have restarted that habit for no gain. See docs/design/accessibility.md.
 */
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
    <header className="flex h-(--size-topbar) shrink-0 items-stretch border-b border-border bg-card pe-3 print:hidden">
      <BrandMark />
      <div className="flex items-center gap-1 ps-2">
        <Button
          variant="ghost"
          size="sm"
          className="xl:hidden"
          onClick={onMobileMenuOpen}
          aria-label={t.nav.openNavigation}
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        {/* It scopes every menu that follows it, so it reads and tabs first. */}
        <AppSwitcher apps={apps} activeApp={activeApp} onSelect={onAppSelect} />
        <Separator orientation="vertical" className="mx-1 hidden h-5 xl:block" />
      </div>
      <nav
        aria-label={t.nav.mainNavigation}
        className="hidden min-w-0 items-stretch xl:flex"
      >
        {sections.map((section) => (
          <NavMenu key={section.id} section={section} activeItemId={activeItemId} />
        ))}
      </nav>
      <div className="ms-auto flex items-center gap-1 ps-2">
        <LanguageToggle />
        <ThemeToggle />
        <NotificationsDropdown />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserMenu />
      </div>
    </header>
  );
}
