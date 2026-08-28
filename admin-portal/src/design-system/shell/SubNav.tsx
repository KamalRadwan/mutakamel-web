"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";

interface SubNavItem {
  href: string;
  labelKey: { en: string; ar: string };
}

/** Generic second-level nav — Backup, Settings, and Provisioning all use this. */
export function SubNav({ items, ariaLabel }: { items: SubNavItem[]; ariaLabel: string }) {
  const pathname = usePathname();
  const { lang } = useI18n();

  const isItemActive = (href: string) =>
    href === items[0]?.href ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label={ariaLabel} className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pb-2">
      {items.map((item) => {
        const active = isItemActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex shrink-0 items-center rounded-md px-3 py-2 text-xs font-medium outline-none transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:bg-ink-100 hover:text-foreground dark:hover:bg-ink-800",
            )}
          >
            {lang === "ar" ? item.labelKey.ar : item.labelKey.en}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-brand-500"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
