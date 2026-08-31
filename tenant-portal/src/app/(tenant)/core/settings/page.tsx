"use client";

import Link from "next/link";
import { ChevronRight, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  SubNav,
  CORE_SETTINGS_NAV_ITEMS,
} from "@/design-system";
import { useSettingsHub } from "./hooks/useSettingsHub";

export default function CoreSettingsHubPage() {
  const { t, sections } = useSettingsHub();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t.coreSettings.hubTitle} description={t.coreSettings.hubSubtitle} />

      <SubNav items={CORE_SETTINGS_NAV_ITEMS} />

      {sections.length === 0 ? (
        // Rendering nothing would read as a broken page. This is a real state:
        // the account holds none of the Core settings read permissions.
        <EmptyState
          icon={ShieldAlert}
          title={t.coreSettings.hubEmptyTitle}
          description={t.coreSettings.hubEmptyDescription}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <Card key={section.href} className="hover:bg-accent">
              <CardContent>
                <Link href={section.href} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{section.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {section.description}
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                    aria-hidden="true"
                  />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
