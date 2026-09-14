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
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-slate-800 bg-[#0f172a] px-3 text-slate-100 shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenMobileNav}
        aria-label={lang === "ar" ? "فتح القائمة الرئيسية" : "Open main navigation"}
        className="size-7 shrink-0 p-0 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <nav aria-label={lang === "ar" ? "مسار التنقل" : "Breadcrumb"} className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-300">
        <Link href={homeHref} className={cn("shrink-0 rounded-md px-1.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white transition-colors", focusRing, hitArea)}>
          {lang === "ar" ? "الرئيسية" : "Home"}
        </Link>
        {activeItem && (
          <>
            <Chevron className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate font-medium text-white" aria-current="page">
              {lang === "ar" ? activeItem.labelKey.ar : activeItem.labelKey.en}
            </span>
          </>
        )}
      </nav>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenSearch}
        aria-label={lang === "ar" ? "فتح البحث السريع" : "Open quick search"}
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-7 gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 text-xs text-slate-200 hover:border-white/25 hover:bg-white/15 hover:text-white sm:flex"
      >
        <Search className="size-3.5 text-slate-300" aria-hidden="true" />
        <span>{lang === "ar" ? "بحث..." : "Search..."}</span>
        <kbd className="ms-2 rounded border border-white/15 bg-white/10 px-1 font-mono text-[11px] text-slate-300" dir="ltr" aria-hidden="true">
          Ctrl K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenSearch}
        aria-label={lang === "ar" ? "فتح البحث السريع" : "Open quick search"}
        aria-keyshortcuts="Control+K Meta+K"
        className="size-7 shrink-0 p-0 text-slate-300 hover:bg-white/10 hover:text-white sm:hidden"
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
