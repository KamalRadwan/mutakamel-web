"use client";

import Link from "next/link";
import { ChevronRight, ChevronLeft, Menu, Search } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useNavTree } from "./useNavTree";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export function Topbar({ onOpenMobileNav, onOpenSearch }: { onOpenMobileNav: () => void; onOpenSearch: () => void }) {
  const { lang, dir } = useI18n();
  const { activeItem, homeHref } = useNavTree();
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-sm">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label={lang === "ar" ? "فتح القائمة الرئيسية" : "Open main navigation"}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground dark:hover:bg-ink-800 lg:hidden",
          focusRing,
        )}
      >
        <Menu className="size-4" aria-hidden="true" />
      </button>

      <nav aria-label={lang === "ar" ? "مسار التنقل" : "Breadcrumb"} className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
        <Link href={homeHref} className={cn("shrink-0 rounded-md px-1.5 py-1 hover:text-foreground", focusRing)}>
          {lang === "ar" ? "الرئيسية" : "Home"}
        </Link>
        {activeItem && (
          <>
            <Chevron className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-foreground">
              {lang === "ar" ? activeItem.labelKey.ar : activeItem.labelKey.en}
            </span>
          </>
        )}
      </nav>

      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex",
          focusRing,
        )}
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span>{lang === "ar" ? "بحث..." : "Search..."}</span>
        <kbd className="ms-2 rounded border border-border bg-background px-1 font-mono text-2xs" dir="ltr">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={lang === "ar" ? "بحث" : "Search"}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground dark:hover:bg-ink-800 sm:hidden",
          focusRing,
        )}
      >
        <Search className="size-4" aria-hidden="true" />
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationDropdown />
        <LanguageToggle />
        <ThemeToggle />
        <UserDropdown />
      </div>
    </header>
  );
}
