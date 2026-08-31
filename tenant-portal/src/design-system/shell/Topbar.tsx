"use client";

import { Menu } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../primitives/Button";
import { Separator } from "../primitives/Separator";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export interface TopbarProps {
  onMobileMenuOpen: () => void;
}

// 44px, one height token (--size-topbar) used everywhere — fixes D6's three
// conflicting hard-coded heights. No search here: search belongs to a
// workspace's own FilterBar, scoped to that workspace's data.
export function Topbar({ onMobileMenuOpen }: TopbarProps) {
  const { t } = useI18n();

  return (
    <header className="flex h-(--size-topbar) shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 print:hidden">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMobileMenuOpen} aria-label={t.nav.workspaceCenter}>
          <Menu className="size-4" aria-hidden="true" />
        </Button>
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
