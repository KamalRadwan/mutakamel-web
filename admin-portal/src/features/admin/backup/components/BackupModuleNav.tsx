"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArchiveRestore,
  CalendarClock,
  DatabaseBackup,
  FileArchive,
  Gauge,
  KeyRound,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function BackupModuleNav() {
  const pathname = usePathname();
  const { lang, t } = useI18n();

  const items = [
    { href: "/backup", label: t.backup.navigation.overview, icon: Gauge },
    { href: "/backup/access", label: t.backup.navigation.databaseAccess, icon: KeyRound },
    { href: "/backup/policies", label: t.backup.navigation.policies, icon: CalendarClock },
    { href: "/backup/runs", label: t.backup.navigation.runs, icon: DatabaseBackup },
    { href: "/backup/artifacts", label: t.backup.navigation.artifacts, icon: FileArchive },
    { href: "/backup/restores", label: t.backup.navigation.restores, icon: ArchiveRestore },
  ] as const;

  const isActive = (href: string) => {
    if (href === "/backup") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <section className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="w-full px-4 pt-4 sm:pt-5">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/70 dark:bg-cyan-950/50 dark:text-cyan-300">
              <DatabaseBackup className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 ${lang === "en" ? "uppercase tracking-[0.16em]" : ""}`}>
                {t.backup.eyebrow}
              </p>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                  {t.backup.title}
                </p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  {t.backup.serviceBoundary}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600 dark:text-slate-400">
                {t.backup.subtitle}
              </p>
            </div>
          </div>
        </div>

        <nav
          aria-label={t.backup.navigationLabel}
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
        >
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${
                  active
                    ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 ${active ? "text-cyan-600 dark:text-cyan-300" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-cyan-500"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
