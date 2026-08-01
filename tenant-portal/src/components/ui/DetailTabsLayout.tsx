"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { ArrowLeft, ArrowRight, Settings, History, Info } from "lucide-react";

interface DetailTabsLayoutProps {
  title: string;
  subtitle?: string;
  basePath: string; // e.g. /core/users/123
  children: React.ReactNode;
}

export function DetailTabsLayout({
  title,
  subtitle,
  basePath,
  children,
}: DetailTabsLayoutProps) {
  const pathname = usePathname();
  const { dir, t } = useI18n();

  const tabs = [
    { label: t.common.general, href: `${basePath}/general`, icon: Info },
    { label: t.common.settings, href: `${basePath}/settings`, icon: Settings },
    { label: t.common.history, href: `${basePath}/history`, icon: History },
  ];

  const ArrowIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={basePath.split("/").slice(0, -1).join("/")}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          {subtitle && (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                isActive
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
