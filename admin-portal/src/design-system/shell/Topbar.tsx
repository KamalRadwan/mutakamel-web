"use client";

import Link from "next/link";
import { ChevronRight, ChevronLeft, Menu, Search } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useNavTree } from "./useNavTree";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { Button } from "../primitives/Button";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";

export function Topbar({ onOpenMobileNav, onOpenSearch }: { onOpenMobileNav: () => void; onOpenSearch: () => void }) {
  const { lang, dir } = useI18n();
  const { activeItem, homeHref } = useNavTree();
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={onOpenMobileNav}
        aria-label={lang === "ar" ? "فتح القائمة الرئيسية" : "Open main navigation"}
        className="size-8 shrink-0 p-0 text-muted-foreground lg:hidden"
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <nav aria-label={lang === "ar" ? "مسار التنقل" : "Breadcrumb"} className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
        <Link href={homeHref} className={cn("shrink-0 rounded-md px-1.5 py-1 hover:bg-accent hover:text-accent-foreground", focusRing, hitArea)}>
          {lang === "ar" ? "الرئيسية" : "Home"}
        </Link>
        {activeItem && (
          <>
            <Chevron className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-foreground" aria-current="page">
              {lang === "ar" ? activeItem.labelKey.ar : activeItem.labelKey.en}
            </span>
          </>
        )}
      </nav>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onOpenSearch}
        aria-label={lang === "ar" ? "فتح البحث السريع" : "Open quick search"}
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden gap-2 bg-background text-muted-foreground sm:flex"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span>{lang === "ar" ? "بحث..." : "Search..."}</span>
        <kbd className="ms-2 rounded border border-border bg-card px-1 font-mono text-xs" dir="ltr" aria-hidden="true">
          Ctrl K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={onOpenSearch}
        aria-label={lang === "ar" ? "فتح البحث السريع" : "Open quick search"}
        aria-keyshortcuts="Control+K Meta+K"
        className="size-8 shrink-0 p-0 text-muted-foreground sm:hidden"
      >
        <Search className="size-4" aria-hidden="true" />
      </Button>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationDropdown />
        <LanguageToggle />
        <ThemeToggle />
        <UserDropdown />
      </div>
    </header>
  );
}
