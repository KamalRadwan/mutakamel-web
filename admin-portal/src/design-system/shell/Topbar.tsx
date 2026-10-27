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
    <header className="nav-surface sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-nav-chrome-line bg-gradient-header px-3 text-nav-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-brand-strip print:hidden" />
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={onOpenMobileNav}
        aria-label={lang === "ar" ? "فتح القائمة الرئيسية" : "Open main navigation"}
        className="size-9 shrink-0 rounded-full p-0 text-nav-foreground hover:bg-white/10 hover:text-nav-foreground-strong lg:hidden"
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <nav aria-label={lang === "ar" ? "مسار التنقل" : "Breadcrumb"} className="flex min-w-0 flex-1 items-center gap-1 text-xs text-nav-foreground">
        <Link
          href={homeHref}
          className={cn(
            "shrink-0 rounded-md px-1.5 py-1 text-nav-foreground transition-colors hover:bg-white/10 hover:text-nav-foreground-strong motion-reduce:transition-none",
            focusRing,
            hitArea,
          )}
        >
          {lang === "ar" ? "الرئيسية" : "Home"}
        </Link>
        {activeItem && (
          <>
            <Chevron className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-nav-foreground-strong" aria-current="page">
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
        className="hidden h-9 gap-2 rounded-full border-nav-chrome-line bg-white/5 px-3 text-nav-foreground hover:bg-white/10 hover:text-nav-foreground-strong sm:flex"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span>{lang === "ar" ? "بحث..." : "Search..."}</span>
        <kbd className="ms-2 rounded border border-nav-chrome-line bg-white/10 px-1.5 font-mono text-xs text-nav-foreground" dir="ltr" aria-hidden="true">
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
        className="size-9 shrink-0 rounded-full p-0 text-nav-foreground hover:bg-white/10 hover:text-nav-foreground-strong sm:hidden"
      >
        <Search className="size-4" aria-hidden="true" />
      </Button>

      <div className="flex shrink-0 items-center gap-1.5">
        <NotificationDropdown />
        <LanguageToggle tone="chrome" />
        <ThemeToggle tone="chrome" />
        <UserDropdown />
      </div>
    </header>
  );
}
