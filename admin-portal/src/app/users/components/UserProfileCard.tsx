"use client";

import React from "react";
import { Sliders, SunMoon, Globe, LayoutGrid } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { AdminUserProfile } from "../types";

export function UserProfileCard({ profile }: { profile?: AdminUserProfile | null }) {
  const { t } = useI18n();

  if (!profile) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-500" />
            <span>{t.users.profilePreferences}</span>
          </h2>
        </div>
        <div className="p-6 text-center text-xs text-slate-400">
          {t.users.noProfile}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-500" />
          <span>{t.users.profilePreferences}</span>
        </h2>
      </div>

      <div className="p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
          <span className="text-slate-500 flex items-center gap-1.5">
            <SunMoon className="w-3.5 h-3.5 text-slate-400" />
            {t.users.themeKey}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
            {profile.themeKey || "default"}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            {t.users.language}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase font-mono">
            {profile.language || "en"}
          </span>
        </div>

        {Boolean(profile.extensions?.tableDensity) && (
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500 flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
              {t.users.tableDensity}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
              {String(profile.extensions?.tableDensity)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
