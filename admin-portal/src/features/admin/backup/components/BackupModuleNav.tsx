"use client";

import { DatabaseBackup } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { SubNav, BACKUP_SUBNAV } from "@/design-system";

export function BackupModuleNav() {
  const { lang, t } = useI18n();

  return (
    <section className="border-b border-border bg-card">
      <div className="w-full px-3.5 pt-3">
        <div className="flex flex-col gap-2.5 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-info/30 bg-info-subtle text-info-subtle-foreground">
              <DatabaseBackup className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold text-muted-foreground ${lang === "en" ? "uppercase tracking-[0.16em]" : ""}`}>
                {t.backup.eyebrow}
              </p>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold tracking-tight text-foreground">{t.backup.title}</p>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {t.backup.serviceBoundary}
                </span>
              </div>
            </div>
          </div>
        </div>

        <SubNav
          items={BACKUP_SUBNAV.map((item) => ({ href: item.href, labelKey: item.labelKey }))}
          ariaLabel={t.backup.navigationLabel}
        />
      </div>
    </section>
  );
}
