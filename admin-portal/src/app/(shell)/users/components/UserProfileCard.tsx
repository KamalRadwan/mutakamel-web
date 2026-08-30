"use client";

import { Sliders, SunMoon, Globe, LayoutGrid } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { AdminUserProfile } from "../types";

export function UserProfileCard({ profile }: { profile?: AdminUserProfile | null }) {
  const { t } = useI18n();

  if (!profile) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted/50 p-4">
          <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <Sliders className="w-4 h-4 text-muted-foreground" />
            <span>{t.users.profilePreferences}</span>
          </h2>
        </div>
        <div className="p-6 text-center text-xs text-muted-foreground">
          {t.users.noProfile}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/50 p-4">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Sliders className="w-4 h-4 text-muted-foreground" />
          <span>{t.users.profilePreferences}</span>
        </h2>
      </div>

      <div className="p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <SunMoon className="w-3.5 h-3.5 text-muted-foreground" />
            {t.users.themeKey}
          </span>
          <span className="font-semibold text-foreground capitalize">
            {profile.themeKey || "default"}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            {t.users.language}
          </span>
          <span className="font-semibold text-foreground uppercase font-mono">
            {profile.language || "en"}
          </span>
        </div>

        {Boolean(profile.extensions?.tableDensity) && (
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
              {t.users.tableDensity}
            </span>
            <span className="font-semibold text-foreground capitalize">
              {String(profile.extensions?.tableDensity)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
