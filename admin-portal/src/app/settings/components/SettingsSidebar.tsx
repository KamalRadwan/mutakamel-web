"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  ShieldCheck,
  CreditCard,
  Bell,
  Phone,
  Mail,
  Server,
  Siren,
  HardDrive,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function SettingsSidebar() {
  const pathname = usePathname();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { t, lang } = useI18n();

  const links = [
    {
      href: "/settings/platform",
      label: t.settings.tabs.platform,
      icon: Server,
      color: "text-blue-500",
    },
    {
      href: "/settings/auth",
      label: t.settings.tabs.auth,
      icon: ShieldCheck,
      color: "text-emerald-500",
    },
    {
      href: "/settings/billing",
      label: t.settings.tabs.billing,
      icon: CreditCard,
      color: "text-indigo-500",
    },
    {
      href: "/settings/notifications",
      label: t.settings.tabs.notifications,
      icon: Bell,
      color: "text-amber-500",
    },
    {
      href: "/settings/asterisk",
      label: t.settings.tabs.webphone,
      icon: Phone,
      color: "text-purple-500",
    },
    {
      href: "/settings/smtp",
      label: t.settings.tabs.smtp,
      icon: Mail,
      color: "text-rose-500",
    },
    {
      href: "/settings/fatal-alerts",
      label: t.settings.tabs.fatalAlerts,
      icon: Siren,
      color: "text-red-500",
    },
    {
      href: "/settings/storage",
      label: t.settings.tabs.storageRuntime,
      icon: HardDrive,
      color: "text-cyan-500",
    },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-1">
      <div className="mb-4 px-3">
        <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4.5 h-4.5 text-blue-500" />
          {t.settings.pageTitle}
        </h2>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-white" : link.color}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
