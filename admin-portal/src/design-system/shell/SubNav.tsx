"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";
import { Button } from "../primitives/Button";
import { useSubNav } from "./useSubNav";

interface SubNavItem {
  href: string;
  labelKey: { en: string; ar: string };
}

/** Generic second-level nav — Backup, Settings, and Provisioning all use this. */
export function SubNav({ items, ariaLabel }: { items: SubNavItem[]; ariaLabel: string }) {
  const pathname = usePathname();
  const { lang, dir } = useI18n();
  const layoutKey = items.map((item) => (lang === "ar" ? item.labelKey.ar : item.labelKey.en)).join("|");
  const { scrollerRef, canScrollStart, canScrollEnd, scrollToStart, scrollToEnd } = useSubNav(pathname, layoutKey);
  const StartIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const EndIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const hasOverflow = canScrollStart || canScrollEnd;

  const isItemActive = (href: string) =>
    href === items[0]?.href ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label={ariaLabel} className="relative -mx-1 border-b border-line-column">
      {hasOverflow && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={canScrollStart ? scrollToStart : undefined}
          aria-disabled={!canScrollStart}
          aria-label={lang === "ar" ? `تمرير ${ariaLabel} نحو البداية` : `Scroll ${ariaLabel} toward the beginning`}
          className="absolute start-0 top-1 z-10 size-8 border-line-control bg-surface-toolbar p-0 text-foreground-secondary hover:bg-surface-subtle hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:text-muted-foreground"
        >
          <StartIcon className="size-4" aria-hidden="true" />
        </Button>
      )}

      <div
        ref={scrollerRef}
        className="flex gap-1 overflow-x-auto px-12 pb-2"
      >
        {items.map((item) => {
          const active = isItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-subnav-link
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-xs transition-colors motion-reduce:transition-none",
                active
                  ? "bg-gradient-primary font-semibold text-white shadow-nav-active"
                  : "font-medium text-foreground-secondary hover:bg-surface-subtle hover:text-foreground",
                focusRing,
                hitArea,
              )}
            >
              {lang === "ar" ? item.labelKey.ar : item.labelKey.en}
            </Link>
          );
        })}
      </div>

      {hasOverflow && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={canScrollEnd ? scrollToEnd : undefined}
          aria-disabled={!canScrollEnd}
          aria-label={lang === "ar" ? `تمرير ${ariaLabel} نحو النهاية` : `Scroll ${ariaLabel} toward the end`}
          className="absolute end-0 top-1 z-10 size-8 border-line-control bg-surface-toolbar p-0 text-foreground-secondary hover:bg-surface-subtle hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:text-muted-foreground"
        >
          <EndIcon className="size-4" aria-hidden="true" />
        </Button>
      )}
    </nav>
  );
}
